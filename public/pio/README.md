# 看板娘资源与配置指南

`public/pio/` 保存项目可直接访问的 Spine 与 Live2D 模型资源。两类看板娘的实际配置都位于 `src/config/pioConfig.ts`，类型定义位于 `src/types/pioConfig.ts`；不要再修改已经不存在的 `src/config.ts`。

## 当前资源结构

```text
public/pio/
├── static/
│   ├── spine-player.min.css
│   └── spine-player.min.js
└── models/
    ├── spine/firefly/
    │   ├── 1310.json
    │   ├── 1310.atlas
    │   ├── 1310.png
    │   ├── images/
    │   └── audio/
    └── live2d/snow_miku/
        ├── model.json
        ├── model.moc
        ├── textures/
        └── motions/
```

Static-file paths start at `/pio/`. The bundled Spine model currently uses `/pio/models/spine/firefly/1310.json`; the bundled Live2D model uses `/pio/models/live2d/snow_miku/model.json`.

## Spine configuration

Edit `spineModelConfig` in `src/config/pioConfig.ts`:

- `enable`: enables or disables the Spine widget; currently `false`.
- `model`: model path, scale, and X/Y offsets.
- `position`: corner and pixel offsets.
- `size`: widget width and height.
- `interactive.clickAnimations`: animation names selected at random after a click.
- `interactive.clickMessages`: messages selected at random after a click.
- `interactive.messageDisplayTime`: message duration in milliseconds.
- `interactive.idleAnimations` and `idleInterval`: idle animation pool and interval.
- `responsive`: mobile visibility and breakpoint.
- `zIndex` and `opacity`: stacking and transparency.

Animation names must exist in the selected model. The bundled configuration uses `idle` and `emoji_0` through `emoji_5` where applicable.

## Live2D configuration

Edit `live2dWidgetConfig` in the same file:

- `enable`: enables or disables Live2D; currently `false`.
- `model`: one model or an array of switchable model definitions.
- `position`, `size`, `primaryColor`: placement and appearance.
- `transitionDuration`, `transitionType`: entry and exit animation.
- `menus`: menu items and alignment.
- `tips`: welcome text, rotating messages, timing, and offsets.
- `responsive`: mobile visibility and breakpoint.

Remote model URLs are supported by the component, but production use should account for availability, privacy, CORS, performance, and licensing.

## Enable and verify

1. Confirm the model files and license.
2. Set the relevant `enable` field to `true` in `src/config/pioConfig.ts`.
3. Start the project with `pnpm dev` and open `http://127.0.0.1:5173/`.
4. Check desktop/mobile visibility, browser console errors, animation names, clicks, messages, and SPA navigation.
5. Before release, run `pnpm check`, `pnpm type-check`, and `pnpm build`.

Large model files affect first-load performance. Keep both widget types disabled unless they are deliberately needed, and never add a model without confirming redistribution rights.
