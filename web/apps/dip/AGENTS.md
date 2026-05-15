# 数字员工平台前端代码

## 目录结构

```
.
├── charts/dip-frontend       # KWeaver DIP Frontend Helm 配置
├── ci/nginx.conf             # KWeaver DIP Frontend Nginx 配置
├── src/
│   └── apis/                 # 依赖的 OpenAPI 封装
│   └── assets/               # 图片、字体图标等静态资源
│   └── components/           # 业务组件
│   └── hooks/                # 通用自定义业务 hooks
│   └── i18n/                 # 国际化资源
│   └── pages/                # 页面组件，和路由一一对应，页面组件包含业务组件
│   └── routes/               # 路由定义
│   └── stores/               # 状态组件
│   └── styles/               # 全局样式
│   └── types/                # TypeScript 类型定义
│   └── utils/                # 通用基础方法
├── env.example               # 环境变量模板
├── env.local                 # 环境变量配置
├── Dockerfile                # Docker 镜像构建脚本
```
