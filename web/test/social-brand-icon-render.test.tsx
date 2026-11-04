import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SocialProviderBrandIcon } from "@/supdance/plugins/social-auth/components/social-provider-icons";

describe("social brand icon theme variants", () => {
    test("renders an uploaded dark icon when no light icon was uploaded", () => {
        const markup = renderToStaticMarkup(<SocialProviderBrandIcon provider="qq" iconLightUrl="  " iconDarkUrl=" /uploads/qq-dark.png " />);
        expect(markup).toContain('data-social-brand-icon="qq"');
        expect(markup.match(/src="\/uploads\/qq-dark.png"/g)).toHaveLength(2);
        expect(markup).not.toContain("<svg");
    });

    test("keeps distinct light and dark images when both were uploaded", () => {
        const markup = renderToStaticMarkup(<SocialProviderBrandIcon provider="qq" iconLightUrl="/uploads/qq-light.png" iconDarkUrl="/uploads/qq-dark.png" />);
        expect(markup).toContain('src="/uploads/qq-light.png"');
        expect(markup).toContain('src="/uploads/qq-dark.png"');
        expect(markup).toContain("dark:hidden");
        expect(markup).toContain("dark:block");
    });

    test("uses a single light upload in both themes and defaults after clearing both", () => {
        const custom = renderToStaticMarkup(<SocialProviderBrandIcon provider="qq" iconLightUrl="/uploads/qq-light.png" />);
        expect(custom.match(/src="\/uploads\/qq-light.png"/g)).toHaveLength(2);
        const cleared = renderToStaticMarkup(<SocialProviderBrandIcon provider="qq" iconLightUrl="" iconDarkUrl="" />);
        expect(cleared).toContain("<svg");
        expect(cleared).not.toContain("<img");
    });
});
