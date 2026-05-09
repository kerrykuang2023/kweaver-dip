import { create } from 'zustand'
import type {
  AppAccount,
  BknEntry,
  ChannelConfig,
  DigitalHumanDetail,
  DigitalHumanSkill,
} from '@/apis'

export type DigitalHumanUiMode = 'create' | 'edit' | 'view'

type DigitalHumanDetailForUI = Omit<DigitalHumanDetail, 'skills'> & {
  /** UI 使用技能对象列表（由 `getDigitalHumanSkills` 加载并渲染） */
  skills?: DigitalHumanSkill[]
}

/** 编辑态基础信息（对齐 DigitalHumanDetail 中的 name / description / creature / soul） */
export type DigitalHumanBasic = Pick<DigitalHumanDetail, 'name' | 'creature' | 'soul'>

export type { BknEntry, ChannelConfig } from '@/apis'

export const REMOVABLE_PRESET_SKILL_NAMES = new Set(['feishu-push'])
export const REQUIRED_PRESET_SKILL_NAMES = new Set(['mcporter'])
export const REQUIRED_PRESET_SKILLS: DigitalHumanSkill[] = [
  {
    name: 'mcporter',
    built_in: false,
    type: 'official',
  },
]

const isRemovablePresetSkillName = (skillName: string) =>
  REMOVABLE_PRESET_SKILL_NAMES.has(skillName)

export const isRequiredPresetSkillName = (skillName: string) =>
  REQUIRED_PRESET_SKILL_NAMES.has(skillName)

export interface DigitalHumanState {
  /** 当前页面编辑状态：新建/编辑/详情 */
  uiMode: DigitalHumanUiMode

  /** 当前正在配置的数字员工 ID（与 API 一致为 string） */
  digitalHumanId?: string

  /** 原始详情快照（UI 侧补齐 `skills` 为对象列表） */
  detail: DigitalHumanDetailForUI | null

  /** 基本信息 */
  basic: DigitalHumanBasic

  /** 知识源列表（对齐 DigitalHumanExtension.bkn） */
  bkn: BknEntry[]

  /** 本次配置选择的应用账户；详情接口不回显历史账户时保持为空 */
  appAccount?: AppAccount

  /** 本次配置生成的 KWeaver Token；undefined 表示不更新，null 表示删除 */
  kweaverToken?: string | null

  /** 技能列表（用于渲染与编辑） */
  skills: DigitalHumanSkill[]

  /** 用户已主动移除的可移除预置技能名称 */
  removedPresetSkillNames: string[]

  /** 已绑定的渠道凭证（对齐 DigitalHumanExtension.channel，单通道） */
  channel?: ChannelConfig

  /** 标记是否有未发布改动（后续可用于提示） */
  dirty: boolean

  /**
   * 管理员配置页进入「编辑」时快照的名称，用于顶栏/面包屑；表单内改名不更新该字段，保存成功或退出编辑后清除。
   */
  frozenDisplayNameForEdit: string | null

  /** 绑定当前数字员工，并根据详情初始化数据 */
  bindDigitalHuman: (
    digitalHuman: DigitalHumanDetail | null,
    agentSkills?: DigitalHumanSkill[],
  ) => void

  /** 重置 dirty 状态（不改变数据内容） */
  resetDirtyState: () => void

  /** 重置所有数据到原始详情 */
  resetAllToDetail: () => void

  /** 设置当前页面编辑状态 */
  setUiMode: (mode: DigitalHumanUiMode) => void

  /** 更新基础信息 */
  updateBasic: (patch: Partial<DigitalHumanBasic>) => void
  /** 批量覆盖知识源列表 */
  updateBkn: (patches: BknEntry[]) => void
  /** 删除单个知识源（按 id） */
  deleteBkn: (id: string) => void
  /** 更新应用账户与运行时 Token */
  updateAppAccount: (account: AppAccount, token: string) => void
  /** 清除应用账户与 Token，同时清空知识范围 */
  deleteAppAccount: () => void
  /** 更新技能目录名列表（整组替换） */
  updateSkills: (patches: DigitalHumanSkill[]) => void
  /** 合并默认预置技能到当前配置和详情快照，不标记 dirty */
  syncBuiltInSkills: (presetSkills: DigitalHumanSkill[]) => void
  /** 删除单个技能（按目录名） */
  deleteSkill: (skillDirectoryName: string) => void
  /** 更新渠道配置 */
  updateChannel: (channel: ChannelConfig) => void
  /** 清除渠道配置 */
  deleteChannel: () => void
  /** 重置当前数据 */
  reset: () => void
}

const defaultBasic: DigitalHumanBasic = {
  name: '',
  creature: '',
  soul: '',
}

const defaultSkills: DigitalHumanSkill[] = []

const defaultBkn: BknEntry[] = []

const mergeSkillsByName = (
  currentSkills: DigitalHumanSkill[],
  nextSkills: DigitalHumanSkill[],
): DigitalHumanSkill[] => {
  if (nextSkills.length === 0) return currentSkills
  const existedNames = new Set(currentSkills.map((skill) => skill.name))
  const appendedSkills = nextSkills.filter((skill) => !existedNames.has(skill.name))
  if (appendedSkills.length === 0) return currentSkills
  return [...currentSkills, ...appendedSkills]
}

export const ensureRequiredPresetSkills = (skills: DigitalHumanSkill[]): DigitalHumanSkill[] =>
  mergeSkillsByName(skills, REQUIRED_PRESET_SKILLS)

export const ensureRequiredPresetSkillNames = (skillNames: string[]): string[] => {
  const names = new Set(skillNames)
  for (const skillName of REQUIRED_PRESET_SKILL_NAMES) {
    names.add(skillName)
  }
  return Array.from(names)
}

export const useDigitalHumanStore = create<DigitalHumanState>()((set) => ({
  uiMode: 'create',
  digitalHumanId: undefined,
  basic: defaultBasic,
  bkn: defaultBkn,
  appAccount: undefined,
  kweaverToken: undefined,
  skills: defaultSkills,
  removedPresetSkillNames: [],
  channel: undefined,
  detail: null,
  dirty: false,
  frozenDisplayNameForEdit: null,

  setUiMode: (mode) =>
    set((state) => {
      if (mode === 'edit') {
        const name = state.basic.name.trim()
        return { uiMode: mode, frozenDisplayNameForEdit: name || null }
      }
      return { uiMode: mode, frozenDisplayNameForEdit: null }
    }),

  bindDigitalHuman: (digitalHuman, agentSkills) => {
    if (!digitalHuman) {
      set({
        digitalHumanId: undefined,
        basic: defaultBasic,
        bkn: defaultBkn,
        appAccount: undefined,
        kweaverToken: undefined,
        skills: defaultSkills,
        removedPresetSkillNames: [],
        channel: undefined,
        dirty: false,
        detail: null,
        frozenDisplayNameForEdit: null,
      })
      return
    }

    set((state) => {
      const name = digitalHuman.name?.trim() ?? ''
      const nextSkills = ensureRequiredPresetSkills(agentSkills ?? defaultSkills)
      const next = {
        digitalHumanId: digitalHuman.id,
        basic: {
          name: digitalHuman.name ?? '',
          creature: digitalHuman.creature ?? '',
          soul: digitalHuman.soul ?? '',
        },
        bkn: digitalHuman.bkn ?? defaultBkn,
        appAccount: undefined,
        kweaverToken: undefined,
        skills: nextSkills,
        removedPresetSkillNames: [],
        channel: digitalHuman.channel,
        // detail 快照用于 resetAllToDetail：skills 则应始终是 UI 可用的对象列表
        detail: {
          ...digitalHuman,
          skills: nextSkills,
        } as DigitalHumanDetailForUI,
        dirty: false,
      }
      if (state.uiMode === 'edit' && state.frozenDisplayNameForEdit === null && name) {
        return { ...next, frozenDisplayNameForEdit: name }
      }
      return next
    })
  },

  resetDirtyState: () => {
    set({ dirty: false })
  },

  updateBasic: (patch) =>
    set((state) => ({
      basic: { ...state.basic, ...patch },
      dirty: true,
    })),

  updateBkn: (patches) =>
    set(() => ({
      bkn: patches,
      dirty: true,
    })),

  deleteBkn: (id) =>
    set((state) => ({
      bkn: state.bkn.filter((k) => k.id !== id),
      dirty: true,
    })),

  updateAppAccount: (account, token) =>
    set({
      appAccount: account,
      kweaverToken: token,
      dirty: true,
    }),

  deleteAppAccount: () =>
    set({
      appAccount: undefined,
      kweaverToken: null,
      bkn: defaultBkn,
      dirty: true,
    }),

  updateSkills: (patches) =>
    set((state) => {
      const nextPatches = ensureRequiredPresetSkills(patches)
      const selectedSkillNames = new Set(nextPatches.map((skill) => skill.name))
      const removedPresetSkillNames = new Set(state.removedPresetSkillNames)

      for (const skillName of REMOVABLE_PRESET_SKILL_NAMES) {
        if (selectedSkillNames.has(skillName)) {
          removedPresetSkillNames.delete(skillName)
          continue
        }

        if (state.skills.some((skill) => skill.name === skillName)) {
          removedPresetSkillNames.add(skillName)
        }
      }

      return {
        skills: nextPatches,
        removedPresetSkillNames: Array.from(removedPresetSkillNames),
        dirty: true,
      }
    }),

  syncBuiltInSkills: (presetSkills) =>
    set((state) => {
      const removedPresetSkillNames = new Set(state.removedPresetSkillNames)
      const syncablePresetSkills = ensureRequiredPresetSkills(
        presetSkills.filter(
          (skill) =>
            skill.built_in ||
            isRequiredPresetSkillName(skill.name) ||
            !removedPresetSkillNames.has(skill.name),
        ),
      )
      const nextSkills = mergeSkillsByName(state.skills, syncablePresetSkills)
      const nextDetailSkills = mergeSkillsByName(
        state.detail?.skills ?? defaultSkills,
        syncablePresetSkills,
      )

      if (
        nextSkills === state.skills &&
        nextDetailSkills === (state.detail?.skills ?? defaultSkills)
      ) {
        return state
      }

      return {
        skills: nextSkills,
        detail: state.detail
          ? {
              ...state.detail,
              skills: nextDetailSkills,
            }
          : state.detail,
      }
    }),

  deleteSkill: (skillName) =>
    set((state) => {
      if (isRequiredPresetSkillName(skillName)) {
        return state
      }

      return {
        skills: state.skills.filter((s) => s.name !== skillName),
        removedPresetSkillNames: isRemovablePresetSkillName(skillName)
          ? Array.from(new Set([...state.removedPresetSkillNames, skillName]))
          : state.removedPresetSkillNames,
        dirty: true,
      }
    }),

  updateChannel: (channel) =>
    set({
      channel,
      dirty: true,
    }),

  deleteChannel: () =>
    set({
      channel: undefined,
      dirty: true,
    }),

  resetAllToDetail: () =>
    set((state) => ({
      basic: {
        name: state.detail?.name ?? '',
        creature: state.detail?.creature ?? '',
        soul: state.detail?.soul ?? '',
      },
      bkn: state.detail?.bkn ?? defaultBkn,
      appAccount: undefined,
      kweaverToken: undefined,
      skills: ensureRequiredPresetSkills(state.detail?.skills ?? defaultSkills),
      removedPresetSkillNames: [],
      channel: state.detail?.channel ?? undefined,
      dirty: false,
    })),

  reset: () =>
    set(() => ({
      digitalHumanId: undefined,
      basic: defaultBasic,
      bkn: defaultBkn,
      appAccount: undefined,
      kweaverToken: undefined,
      skills: defaultSkills,
      removedPresetSkillNames: [],
      channel: undefined,
      dirty: false,
      detail: null,
      frozenDisplayNameForEdit: null,
    })),
}))
