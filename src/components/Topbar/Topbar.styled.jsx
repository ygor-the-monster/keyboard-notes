import { style } from "@react-spectrum/s2/style" with { type: "macro" };

// Spectrum `styles=` props only (layout lives in Topbar.module.css).
export const vdiv = style({ height: 28, alignSelf: "center" });
export const titleField = style({ flexGrow: 1, flexShrink: 1, minWidth: 0 });
