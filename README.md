# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Node 版本与环境管理

本项目已锁定 Node 版本，确保团队一致性并避免“Node 版本不兼容”问题：

- `.nvmrc`: `v20.11.1`
- `.node-version`: `20.11.1`
- `package.json > engines`：要求 `node ">=20.11.0 <23"`、`npm ">=10 <11"`
- `.npmrc`: `engine-strict=true`（安装时强制校验 engines）

### 使用 nvm（macOS/Linux）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
exec "$SHELL" # 让 nvm 立刻生效
nvm install
nvm use
npm -v && node -v
```

如需将该版本设为默认：

```bash
nvm alias default 20.11.1
```

### 使用 Volta（可选，跨平台开发者推荐）

```bash
curl https://get.volta.sh | bash
volta install node@20.11.1 npm@10
```

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
