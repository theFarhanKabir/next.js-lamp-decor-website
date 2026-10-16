const unsplash = (photo: string, width: number) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=80`;

export type ResponsiveImageVariant = { url: string; width: number; height: number; storagePath: string; bytes?: number };
export type HeroSlide = { image: string; imageVariants?: ResponsiveImageVariant[]; alt: string; eyebrow: string; headline: string; subtext: string; ctaLabel: string; categorySlug: string; active: boolean };
export type HomeCategory = { name: string; image: string; imageVariants?: ResponsiveImageVariant[]; alt: string; slug: string; active: boolean };
export type HotDeal = { productId: string; name: string; category: string; price: number; was: number; image: string; imageVariants?: ResponsiveImageVariant[]; alt: string; active: boolean };
export type NewArrivalsContent = { title: string; eyebrow: string; productIds: string[]; active: boolean };
export type HomepageContent = { heroSlides: HeroSlide[]; categories: HomeCategory[]; hotDeals: HotDeal[]; hotDealsActive: boolean; newArrivals: NewArrivalsContent };

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  heroSlides: [
    { image: unsplash("photo-1721824296808-92c325601dd8", 1800), alt: "Warmly lit interior with considered lighting", eyebrow: "THE SHADE EDIT", headline: "Quiet forms.\nBeautifully reflected.", subtext: "Thoughtful lighting and mirror details for a more balanced home.", ctaLabel: "Shop the collection", categorySlug: "all", active: true },
    { image: unsplash("photo-1540759772348-12e90305e8f4", 1800), alt: "A bright room featuring reflective surfaces", eyebrow: "MIRRORS THAT OPEN A ROOM", headline: "Let the light\nfind its way in.", subtext: "Reflective forms and finely finished frames for everyday spaces.", ctaLabel: "Shop the collection", categorySlug: "all", active: true },
    { image: unsplash("photo-1716593145277-36e92b658bfe", 1800), alt: "Layered lighting in a calm interior", eyebrow: "LIGHT, LAYERED", headline: "A softer light\nfor quieter rooms.", subtext: "Sculptural lamps and considered mirrors in calm, cool tones.", ctaLabel: "Shop the collection", categorySlug: "all", active: true },
  ],
  categories: [
    { name: "Lamps", image: unsplash("photo-1778880707611-d1f09e32b4e2", 600), alt: "Table and pendant lamps", slug: "lighting", active: true },
    { name: "Mirrors", image: unsplash("photo-1542485028-6e019f9c8a8e", 600), alt: "Decorative wall mirror", slug: "mirrors", active: true },
    { name: "Tables", image: unsplash("photo-1784651859128-b04c1d4732f3", 600), alt: "Oak furniture table", slug: "tables", active: true },
    { name: "Shades", image: unsplash("photo-1774444052266-2e4b58d85c3b", 600), alt: "Decorative lamp shade", slug: "shades", active: true },
    { name: "New Arrivals", image: unsplash("photo-1775667693473-91e07000bb1a", 600), alt: "New lighting collection", slug: "new", active: true },
    { name: "Sale", image: unsplash("photo-1542485028-6e019f9c8a8e", 600), alt: "Furniture on sale", slug: "sale", active: true },
  ],
  hotDeals: [],
  hotDealsActive: false,
  newArrivals: { title: "New Arrivals", eyebrow: "Just arrived", productIds: [], active: false },
};
