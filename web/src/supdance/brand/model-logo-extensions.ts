import type { ModelLogoCategory } from "@/lib/model-logo-catalog";

const murekaLogo = new URL("./mureka.png", import.meta.url).href;

// Preserve the site's existing Mureka ID and asset alongside library icons.
export const SUPDANCE_MODEL_LOGOS = [{ id: "Mureka", label: "Mureka", title: "Mureka", categories: ["audio"] as ModelLogoCategory[], searchText: "mureka music 音乐", src: murekaLogo }];
