// Centralized Provider Logos and Styles configuration for ImageStudio and VideoStudio
// Supports local SVGs as fallback to avoid 403 / 404 CDN missing issues.

export const KREA_LOGO = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNTEyIDUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLW1pdGVybGltaXQ9IjIiPjxnIHRyYW5zZm9ybT0ic2NhbGUoMzIpIj48Y2xpcFBhdGggaWQ9InByZWZpeF9fYSI+PHBhdGggZD0iTTAgMGgxNnYxNkgweiIvPjwvY2xpcFBhdGg+PGcgY2xpcC1wYXRoPSJ1cmwoI3ByZWZpeF9fYSkiPjxwYXRoIGQ9Ik00Ljk0Ny4wMTFDNi4yNTEtLjA4IDcuNDAxLjgyNyA3LjU3IDIuMDhjLjE2IDEuMTktLjY1NSAyLjM0LTEuODc5IDIuNjEtLjMwNy4wNjgtLjY0Ny4wNDktLjk3Mi4wOS0uNzY4LjA5LTEuNDgzLjQ0LTIuMDI4Ljk4OWwtLjAwNy4wMDNoLS4wMDZsLS4wMDUtLjAwNS0uMDAyLS4wMDYuMDAzLS4wMTJhLjAzLjAzIDAgMDAuMDA2LS4wMTZDMi42NyA0LjYxNSAyLjY2OCAzLjQ5OCAyLjY3IDIuMzggMi42NzMgMS4xNCAzLjY1Mi4xMDMgNC45NDcuMDF6Ii8+PHBhdGggZD0iTTUuMDg1IDEwLjM3NUMzLjQyNiAxMC4zNiAyLjIzNyA4LjcyOCAyLjgxNSA3LjJhMi40NDcgMi40NDcgMCAwMTIuMDM0LTEuNTU4Yy4yODQtLjAzLjYyNC0uMDIyLjg5Ny0uMDcyIDEuNDAzLS4yNiAyLjQ4Ny0xLjMzNCAyLjcwNS0yLjcuMDQ5LS4zMDIuMDIzLS42NjQuMDk1LS45ODUuMzMxLTEuNDg4IDIuMDM3LTIuMzIzIDMuNDY5LTEuNjVhMi4zOTMgMi4zOTMgMCAwMTEuMzcgMS44MDZjLjAyNS4xNjIuMDM0LjM2My4wMjUuNjAzLS4xNjIgNC4zMTItMy44NDUgNy43NjUtOC4zMjUgNy43MjhtMi4wOS42ODdhLjAyOS4wMjkgMCAwMS0uMDE2LS4wMTV2LS4wMDRsLjAwMS0uMDA0YzAtLjAwMiAwLS4wMDMuMDAyLS4wMDRsLjAwNC0uMDAyYTkuMzc1IDkuMzc1IDAgMDA0LjQyMy0yLjM1Yy4wMjItLjAyMS4wNDMtLjAyLjA2Mi4wMDQuMTk5LjI2NC40MDguNTQ3LjU3NS44MTdhNy44MjcgNy44MjcgMCAwMTEuMTg3IDQuMjE0Yy0uMDYyIDEuMjU5LTEuMTE0IDIuMjczLTIuNDQzIDIuMjgtMS4xNzUuMDA4LTIuMjA5LS43OTQtMi40MzEtMS45MTYtLjA1NC0uMjY2LS4wMzgtLjYzMy0uMDgyLS45MTRhMy4xNzEgMy4xNzEgMCAwMC0xLjI2Ni0yLjA5NmwtLjAxNi0uMDF6bS0yLjQ4NyA0LjkwMWMtLjk5OS0uMTczLTEuODAyLS45NDktMS45ODEtMS45MTQtLjAyOS0uMi0uMDQxLS40MDEtLjAzNy0uNjAzdi0zLjE5YzAtLjAxMS4wMDMtLjAxMy4wMTEtLjAwNi42NTMuNTggMS4zNC45MzUgMi4yMzYuOTkzbC4yNC4wMDhjMS4xNjcuMDM4IDIuMTU2LjgwMiAyLjM4NCAxLjkxMy4zMzcgMS42NDMtMS4xNSAzLjA5Ny0yLjg1NCAyLjhoLjAwMXoiLz48L2c+PC9nPjwvc3ZnPg==";
export const META_LOGO = "data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjg3LjU2IDE5MSI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMwMDgxZmI7fS5jbHMtMntmaWxsOnVybCgjbGluZWFyLWdyYWRpZW50KTt9LmNscy0ze2ZpbGw6dXJsKCNsaW5lYXItZ3JhZGllbnQtMik7fTwvc3R5bGU+PGxpbmVhckdyYWRpZW50IGlkPSJsaW5lYXItZ3JhZGllbnQiIHgxPSI2Mi4zNCIgeTE9IjEwMS40NSIgeDI9IjI2MC4zNCIgeTI9IjkxLjQ1IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsIDAsIDAsIC0xLCAwLCAxOTIpIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMDA2NGUxIi8+PHN0b3Agb2Zmc2V0PSIwLjQiIHN0b3AtY29sb3I9IiMwMDY0ZTEiLz48c3RvcCBvZmZzZXQ9IjAuODMiIHN0b3AtY29sb3I9IiMwMDczZWUiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMDgyZmIiLz48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBpZD0ibGluZWFyLWdyYWRpZW50LTIiIHgxPSI0MS40MiIgeTE9IjUzIiB4Mj0iNDEuNDIiIHkyPSIxMjYiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwgMCwgMCwgLTEsIDAsIDE5MikiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMwMDgyZmIiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMDY0ZTAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48dGl0bGU+ZmFjZWJvb2stbWV0YTwvdGl0bGU+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMzEuMDYsMTI2YzAsMTEsMi40MSwxOS40MSw1LjU2LDI0LjUxQTE5LDE5LDAsMCwwLDUzLjE5LDE2MGM4LjEsMCwxNS41MS0yLDI5Ljc5LTIxLjc2LDExLjQ0LTE1LjgzLDI0LjkyLTM4LDM0LTUybDE1LjM2LTIzLjZjMTAuNjctMTYuMzksMjMtMzQuNjEsMzcuMTgtNDdDMTgxLjA3LDUuNiwxOTMuNTQsMCwyMDYuMDksMGMyMS4wNywwLDQxLjE0LDEyLjIxLDU2LjUsMzUuMTEsMTYuODEsMjUuMDgsMjUsNTYuNjcsMjUsODkuMjcsMCwxOS4zOC0zLjgyLDMzLjYyLTEwLjMyLDQ0Ljg3QzI3MSwxODAuMTMsMjU4LjcyLDE5MSwyMzguMTMsMTkxVjE2MGMxNy42MywwLDIyLTE2LjIsMjItMzQuNzQsMC0yNi40Mi02LjE2LTU1Ljc0LTE5LjczLTc2LjY5LTkuNjMtMTQuODYtMjIuMTEtMjMuOTQtMzUuODQtMjMuOTQtMTQuODUsMC0yNi44LDExLjItNDAuMjMsMzEuMTctNy4xNCwxMC42MS0xNC40NywyMy41NC0yMi43LDM4LjEzbC05LjA2LDE2Yy0xOC4yLDMyLjI3LTIyLjgxLDM5LjYyLTMxLjkxLDUxLjc1Qzg0Ljc0LDE4Myw3MS4xMiwxOTEsNTMuMTksMTkxYy0yMS4yNywwLTM0LjcyLTkuMjEtNDMtMjMuMDlDMy4zNCwxNTYuNiwwLDE0MS43NiwwLDEyNC44NVoiLz48cGF0aCBjbGFzcz0iY2xzLTIiIGQ9Ik0yNC40OSwzNy4zQzM4LjczLDE1LjM1LDU5LjI4LDAsODIuODUsMGMxMy42NSwwLDI3LjIyLDQsNDEuMzksMTUuNjEsMTUuNSwxMi42NSwzMiwzMy40OCw1Mi42Myw2Ny44MWw3LjM5LDEyLjMyYzE3Ljg0LDI5LjcyLDI4LDQ1LDMzLjkzLDUyLjIyLDcuNjQsOS4yNiwxMywxMiwxOS45NCwxMiwxNy42MywwLDIyLTE2LjIsMjItMzQuNzRsMjcuNC0uODZjMCwxOS4zOC0zLjgyLDMzLjYyLTEwLjMyLDQ0Ljg3QzI3MSwxODAuMTMsMjU4LjcyLDE5MSwyMzguMTMsMTkxYy0xMi44LDAtMjQuMTQtMi43OC0zNi42OC0xNC42MS05LjY0LTkuMDgtMjAuOTEtMjUuMjEtMjkuNTgtMzkuNzFMMTQ2LjA4LDkzLjZjLTEyLjk0LTIxLjYyLTI0LjgxLTM3Ljc0LTMxLjY4LTQ1QzEwNyw0MC43MSw5Ny41MSwzMS4yMyw4Mi4zNSwzMS4yM2MtMTIuMjcsMC0yMi42OSw4LjYxLTMxLjQxLDIxLjc4WiIvPjxwYXRoIGNsYXNzPSJjbHMtMyIgZD0iTTgyLjM1LDMxLjIzYy0xMi4yNywwLTIyLjY5LDguNjEtMzEuNDEsMjEuNzhDMzguNjEsNzEuNjIsMzEuMDYsOTkuMzQsMzEuMDYsMTI2YzAsMTEsMi40MSwxOS40MSw1LjU2LDI0LjUxTDEwLjE0LDE2Ny45MUMzLjM0LDE1Ni42LDAsMTQxLjc2LDAsMTI0Ljg1LDAsOTQuMSw4LjQ0LDYyLjA1LDI0LjQ5LDM3LjMsMzguNzMsMTUuMzUsNTkuMjgsMCw4Mi44NSwwWiIvPjwvc3ZnPg==";
export const TOPAZ_LOGO = "data:image/svg+xml;base64,PHN2ZyBmaWxsPSJjdXJyZW50Q29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgaGVpZ2h0PSIxZW0iIHN0eWxlPSJmbGV4Om5vbmU7bGluZS1oZWlnaHQ6MSIgdmlld0JveD0iMCAwIDI0IDI0IiB3aWR0aD0iMWVtIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0aXRsZT5Ub3BhekxhYnM8L3RpdGxlPjxwYXRoIGQ9Ik0yIDE1LjM1N1YyMmg2LjY1di02LjY0M0gyek0xNS4zMiAxNS4zNTdWOC43MTRIOC42N3Y2LjY0M2g2LjY1ek0yMiA4LjY0M1YyaC02LjY1djYuNjQzSDIyeiI+PC9wYXRoPjwvc3ZnPg==";
export const VOLCENGINE_LOGO = "data:image/svg+xml;base64,PHN2ZyBmaWxsPSJjdXJyZW50Q29sb3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgaGVpZ2h0PSIxZW0iIHN0eWxlPSJmbGV4Om5vbmU7bGluZS1oZWlnaHQ6MSIgdmlld0JveD0iMCAwIDI0IDI0IiB3aWR0aD0iMWVtIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0aXRsZT5Wb2xjZW5naW5lPC90aXRsZT48cGF0aCBkPSJNNy4yOSA1LjM2TDMuMTQ4IDIxLjczN2EuMjE1LjIxNSAwIDAwLjIwMy4yNjFoOC4yOWEuMjE0LjIxNCAwIDAwLjIxNS0uMjYxTDcuNyA1LjM1OWEuMjE0LjIxNCAwIDAwLS40MSAweiIgZmlsbC1vcGFjaXR5PSIuNSI+PC9wYXRoPjxwYXRoIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTQuNTUzIDE2LjE4bC0xLjQwNiA1LjU1OGEuMjE0LjIxNCAwIDAwLjIwMy4yNjFoMi40Mi00LjU1MWEuMjE0LjIxNCAwIDAxLS4yMTQtLjI2bDIuMjc1LTguOTYxYS4yMTQuMjE0IDAgMDEuNDA5IDBsLjg2NCAzLjQwMnoiPjwvcGF0aD48cGF0aCBkPSJNMTQuNDQuMTVhLjIxNC4yMTQgMCAwMC0uNDEgMEw4LjM2NiAyMS43MzlhLjIxNC4yMTQgMCAwMC4yMTQuMjYxSDE5LjlhLjIxNC4yMTQgMCAwMC4yMTUtLjI2MUwxNC40NC4xNTF6IiBmaWxsLW9wYWNpdHk9Ii41Ij48L3BhdGg+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTYuNjk0IDIyaDMuMjA3YS4yMTUuMjE1IDAgMDAuMjE0LS4yNjJsLTEuODM5LTYuOTkzIDEuMTY0LTQuNTkyYS4yMTQuMjE0IDAgMDEuNDExIDBsMi45NTEgMTEuNTg2YS4yMTQuMjE0IDAgMDEtLjIxNC4yNjFoLTUuODk0eiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMC4yNzggNy43NDFMNi42ODUgMjEuNzM2YS4yMTQuMjE0IDAgMDAuMjE0LjI2NGg3LjE3YS4yMTYuMjE2IDAgMDAuMjE0LS4xNjYuMjE2LjIxNiAwIDAwMC0uMDk4TDEwLjY4NyA3Ljc0MmEuMjE0LjIxNCAwIDAwLS40MDkgMHoiPjwvcGF0aD48L3N2Zz4=";
export const MMAUDIO_LOGO = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMiAxMHY0Ii8+PHBhdGggZD0iTTYgNnYxMiIvPjxwYXRoIGQ9Ik0xMCAzdjE4Ii8+PHBhdGggZD0iTTE0IDh2OCIvPjxwYXRoIGQ9Ik0xOCA1djE0Ii8+PHBhdGggZD0iTTIyIDEwdjQiLz48L3N2Zz4=";
export const TALK_LOGO = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjEgMTVhMiAyIDAgMCAxLTIgMkg3bC00IDRWNWEyIDIgMCAwIDEgMi0yaDE0YTIgMiAwIDAgMSAyIDJ6Ii8+PHBhdGggZD0iTTggOWg4Ii8+PHBhdGggZD0iTTggMTNoNSIvPjwvc3ZnPg==";
export const VIDEO_LOGO = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyIiB5PSI0IiB3aWR0aD0iMTUiIGhlaWdodD0iMTYiIHJ4PSIyIi8+PHBhdGggZD0ibTIyIDctNSA1IDUgNVY3eiIvPjwvc3ZnPg==";
export const SEEDREAM_LOGO = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1ydWxlPSJldmVub2RkIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0aXRsZT5TZWVkcmVhbTwvdGl0bGU+PHBhdGggZD0iTTUuMjU3IDEuODA4QzguNzY4IDYuNzQgMTQuNDMxIDkuNDUgMjAuMDY0IDguNDAzYTcuMzk4IDcuMzk4IDAgMDAxLjI4MS0uMzhjLjg1NS0uMzMgMS45NzUgMS4wMSAxLjMyNiAxLjY1OC0uNDMuNDI4LS44NC44Mi0xLjIwOCAxLjE0N2E1MS4xNDkgNTEuMTQ5IDAgMDEtOC4zODkgNi4wNDQgNTEuMTQ2IDUxLjE0NiAwIDAxLTkuNDkgNC4yNjNjLS40NTMuMTUtLjk4LjMwNC0xLjU0Ni40NTctLjg4NS4yMzgtMS40ODQtMS40LS43Ny0xLjk3NS4zNzgtLjMwNi43MTMtLjYxNy45NzgtLjkyN0M1Ljk2OSAxNC4zMzYgNi4yOTkgOC4xNzQgMy43MTcgMi42OTdhMTguMiAxOC4yIDAgMDEtLjM2NC0uODRDMi45OTUuOTggNC4wNDIuMzM1IDQuNjU2IDEuMDU1Yy4yNDMuMjg0LjQ1My41NDUuNjAxLjc1M3pNMTkuNTMgMTMuNjk1Yy0yLjMyNCAyLjg2My0yLjgxNiA1Ljk0NC0yLjM3OCA4LjU4M2wuMDI0LjE2Yy4xMTcuNzktLjgxNiAxLjI3Ny0xLjQ0OC43ODhhMTIuODEzIDEyLjgxMyAwIDAwLS4wOTMtLjA3MmMtMi4xMi0xLjYxNC00LjYyLTIuODI4LTcuOTQ4LTIuNDQ2YTI3Ljk1IDI3Ljk1IDAgMDA2LjA4Ni0yLjYyN2MyLjIxLTEuMjc1IDQuMTQ3LTIuNzc0IDUuNzU2LTQuMzg2eiI+PC9wYXRoPjwvc3ZnPg==";

export const PROVIDER_LOGOS = {
  openai: "/assets/brands/openai.svg",
  google: "/assets/brands/google.svg",
  kling: "/assets/brands/kuaishou.svg",
  kuaishou: "/assets/brands/kuaishou.svg",
  alibaba: "/assets/brands/alibaba.svg",
  bytedance: "/assets/brands/bytedance.svg",
  blackforest: "/assets/brands/bfl.svg",
  bfl: "/assets/brands/bfl.svg",
  flux: "/assets/brands/bfl.svg",
  minimax: "/assets/brands/minimax.svg",
  suno: "/assets/brands/suno.png",
  anthropic: "/assets/brands/anthropic.svg",
  claude: "/assets/brands/anthropic.svg",
  deepseek: "/assets/brands/deepseek.svg",
  tencent: "/assets/brands/tencent.svg",
  hunyuan: "/assets/brands/tencent.svg",
  zhipu: "/assets/brands/zhipu.svg",
  midjourney: "/assets/brands/midjourney.svg",
  vidu: "/assets/brands/vidu.svg",
  runway: "/assets/brands/runway.svg",
  luma: "/assets/brands/luma.svg",
  stability: "/assets/brands/stability.svg",
  pika: "/assets/brands/pika.svg",
  topaz: "/assets/brands/topaz.svg",
  elevenlabs: "/assets/brands/elevenlabs.svg",
  hidream: "/assets/brands/hidream.svg",
  udio: "/assets/brands/udio.svg",
  volcengine: "/assets/brands/bytedance.svg",
  "volcengine-lipsync": "/assets/brands/bytedance.svg",
  "happy-horse": "/assets/brands/kuaishou.svg",
  meshy: "https://cdn.muapi.ai/models/meshy-3.png",
  tripo3d: "https://cdn.muapi.ai/models/tripo3d.png",
  grok: "https://cdn.muapi.ai/models/xai.png",
  xai: "https://cdn.muapi.ai/models/xai.png",
  muapi: "/assets/brands/other.svg",
  ideogram: "https://cdn.muapi.ai/models/ideogram.png",
  leonardoai: "https://cdn.muapi.ai/models/leonardoai.png",
  lightricks: "https://cdn.muapi.ai/models/lightricks.png",
  pixverse: "https://cdn.muapi.ai/models/pixverse.png",
  reve: "https://cdn.muapi.ai/models/reve.png",
  seedream: SEEDREAM_LOGO,
  jimeng: SEEDREAM_LOGO,
  krea: KREA_LOGO,
  meta: META_LOGO,
  mmaudio: MMAUDIO_LOGO,
  "infinite-talk": TALK_LOGO,
  video: VIDEO_LOGO,
};

// All official SVGs and PNGs in /assets/brands/ are already tailored for dark theme.
// We intentionally leave this empty to prevent dark-mode inverted logos turning black.
export const invertLogos = [];

export function getProviderLogo(provider, modelKey) {
  const p = String(provider || '').toLowerCase().trim();
  const m = String(modelKey || '').toLowerCase().trim();
  const full = `${p} ${m}`.trim();
  if (!full) return null;

  if (full.includes('seedream') || full.includes('jimeng') || full.includes('seed') || full.includes('doubao') || full.includes('youchuan') || full.includes('aesthetic')) {
    return SEEDREAM_LOGO;
  }

  if (PROVIDER_LOGOS[p]) return PROVIDER_LOGOS[p];
  if (PROVIDER_LOGOS[m]) return PROVIDER_LOGOS[m];

  if (full.includes('bytedance') || full.includes('volcengine')) return PROVIDER_LOGOS.bytedance;
  if (full.includes('kling') || full.includes('kuaishou') || full.includes('happy-horse')) return PROVIDER_LOGOS.kling;
  if (full.includes('flux') || full.includes('bfl') || full.includes('blackforest')) return PROVIDER_LOGOS.bfl;
  if (full.includes('openai') || full.includes('gpt') || full.includes('sora') || full.includes('dall-e') || full.includes('dalle')) return PROVIDER_LOGOS.openai;
  if (full.includes('minimax') || full.includes('hailuo')) return PROVIDER_LOGOS.minimax;
  if (full.includes('alibaba') || full.includes('wan') || full.includes('qwen') || full.includes('dashscope')) return PROVIDER_LOGOS.alibaba;
  if (full.includes('google') || full.includes('gemini') || full.includes('veo') || full.includes('imagen')) return PROVIDER_LOGOS.google;
  if (full.includes('luma') || full.includes('ray')) return PROVIDER_LOGOS.luma;
  if (full.includes('runway') || full.includes('gen-') || full.includes('gen3') || full.includes('gen2')) return PROVIDER_LOGOS.runway;
  if (full.includes('midjourney') || full.includes('mj')) return PROVIDER_LOGOS.midjourney;
  if (full.includes('suno')) return PROVIDER_LOGOS.suno;
  if (full.includes('udio')) return PROVIDER_LOGOS.udio;
  if (full.includes('anthropic') || full.includes('claude')) return PROVIDER_LOGOS.anthropic;
  if (full.includes('deepseek')) return PROVIDER_LOGOS.deepseek;
  if (full.includes('tencent') || full.includes('hunyuan')) return PROVIDER_LOGOS.tencent;
  if (full.includes('zhipu') || full.includes('cogvideo') || full.includes('glm')) return PROVIDER_LOGOS.zhipu;
  if (full.includes('stability') || full.includes('sd-') || full.includes('sdxl') || full.includes('stable-diffusion')) return PROVIDER_LOGOS.stability;
  if (full.includes('vidu')) return PROVIDER_LOGOS.vidu;
  if (full.includes('pika')) return PROVIDER_LOGOS.pika;
  if (full.includes('topaz')) return PROVIDER_LOGOS.topaz;
  if (full.includes('elevenlabs')) return PROVIDER_LOGOS.elevenlabs;
  if (full.includes('hidream')) return PROVIDER_LOGOS.hidream;
  if (full.includes('talk')) return TALK_LOGO;
  if (full.includes('audio')) return MMAUDIO_LOGO;
  if (full.includes('video')) return VIDEO_LOGO;

  return '/assets/brands/other.svg';
}

export function getProviderStyle(provider) {
  const p = String(provider || '').toLowerCase().trim();
  switch (p) {
    case "grok":
    case "xai":
      return { text: "xI", bg: "bg-orange-500/10 text-orange-400 border-orange-500/25" };
    case "openai":
      return { text: "O", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" };
    case "google":
      return { text: "G", bg: "bg-blue-500/10 text-blue-400 border-blue-500/25" };
    case "blackforest":
      return { text: "BF", bg: "bg-amber-500/10 text-amber-400 border-amber-500/25" };
    case "bytedance":
      return { text: "BD", bg: "bg-purple-500/10 text-purple-400 border-purple-500/25" };
    case "midjourney":
      return { text: "MJ", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" };
    case "kling":
      return { text: "KL", bg: "bg-rose-500/10 text-rose-400 border-rose-500/25" };
    case "vidu":
      return { text: "VD", bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" };
    case "minimax":
      return { text: "MX", bg: "bg-pink-500/10 text-pink-400 border-pink-500/25" };
    case "ideogram":
      return { text: "ID", bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25" };
    case "luma":
      return { text: "LM", bg: "bg-teal-500/10 text-teal-400 border-teal-500/25" };
    case "alibaba":
      return { text: "AL", bg: "bg-sky-500/10 text-sky-400 border-sky-500/25" };
    case "leonardoai":
      return { text: "LE", bg: "bg-violet-500/10 text-violet-400 border-violet-500/25" };
    case "stability":
      return { text: "SD", bg: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/25" };
    case "krea":
      return { text: "KR", bg: "bg-teal-500/10 text-teal-300 border-teal-500/25" };
    case "meta":
      return { text: "ME", bg: "bg-blue-600/10 text-blue-400 border-blue-600/25" };
    case "topaz":
      return { text: "TP", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" };
    case "happy-horse":
      return { text: "HH", bg: "bg-amber-500/10 text-amber-400 border-amber-500/25" };
    case "volcengine":
    case "volcengine-lipsync":
      return { text: "VC", bg: "bg-rose-500/10 text-rose-400 border-rose-500/25" };
    case "mmaudio":
      return { text: "MM", bg: "bg-violet-500/10 text-violet-400 border-violet-500/25" };
    case "infinite-talk":
      return { text: "IT", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" };
    case "video":
      return { text: "VD", bg: "bg-sky-500/10 text-sky-400 border-sky-500/25" };
    default:
      const name = provider ? String(provider).toUpperCase() : "AI";
      return { text: name.substring(0, 2), bg: "bg-primary/10 text-primary border-primary/25" };
  }
}
