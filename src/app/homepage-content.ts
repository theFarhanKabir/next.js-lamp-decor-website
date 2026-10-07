const unsplash = (photo: string, width: number) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=80`;

export type HeroSlide = { image: string; alt: string; eyebrow: string; headline: string; subtext: string; ctaLabel: string; categorySlug: string; active: boolean };
export type HomeCategory = { name: string; image: string; alt: string; slug: string; active: boolean };
export type HotDeal = { productId: string; name: string; category: string; price: number; was: number; image: string; alt: string; active: boolean };
export type HomepageContent = { heroSlides: HeroSlide[]; categories: HomeCategory[]; hotDeals: HotDeal[] };

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
  hotDeals: [
    { productId: "arc-floor-lamp", name: "Arc Brass Floor Lamp", category: "Floor Lamps", price: 115000, was: 138000, image: unsplash("photo-1775667693473-91e07000bb1a", 700), alt: "Arc floor lamp in a reading nook", active: true },
    { productId: "marlow-table-lamp", name: "Marlow Ceramic Table Lamp", category: "Table Lamps", price: 42000, was: 52000, image: unsplash("photo-1564540574859-0dfb63985953", 700), alt: "Ceramic table lamp", active: true },
    { productId: "solis-pendant", name: "Solis Dome Pendant", category: "Pendant Lights", price: 58000, was: 72000, image: unsplash("photo-1778880707611-d1f09e32b4e2", 700), alt: "Dome pendant light", active: true },
    { productId: "cleo-wall-sconce", name: "Cleo Brass Wall Sconce", category: "Wall Lights", price: 36000, was: 45000, image: unsplash("photo-1513506003901-1e6a229e2d15", 700), alt: "Brass wall sconce", active: true },
    { productId: "solene-wall-mirror", name: "Solene Arched Mirror", category: "Wall Mirrors", price: 68000, was: 82000, image: unsplash("photo-1542485028-6e019f9c8a8e", 700), alt: "Arched wall mirror", active: true },
    { productId: "mira-round-mirror", name: "Mira Round Mirror", category: "Mirrors", price: 52000, was: 64000, image: unsplash("photo-1618221195710-dd6b41faaea6", 700), alt: "Round wall mirror", active: true },
    { productId: "oslo-side-table", name: "Oslo Oak Side Table", category: "Side Tables", price: 54000, was: 68000, image: unsplash("photo-1506439773649-6e0eb8cfb237", 700), alt: "Oak side table", active: true },
    { productId: "remy-marble-side-table", name: "Remy Marble Side Table", category: "Tables", price: 76000, was: 92000, image: unsplash("photo-1784651859128-b04c1d4732f3", 700), alt: "Marble side table", active: true },
    { productId: "iris-dining-table", name: "Iris Ash Dining Table", category: "Dining Tables", price: 155000, was: 180000, image: unsplash("photo-1519710164239-da123dc03ef4", 700), alt: "Ash dining table", active: true },
    { productId: "cole-nesting-tables", name: "Cole Nesting Tables", category: "Nesting Tables", price: 64000, was: 78000, image: unsplash("photo-1616486338812-3dadae4b4ace", 700), alt: "Nesting tables", active: true },
    { productId: "isla-linen-lamp-shade", name: "Isla Linen Lampshade", category: "Lamp Shades", price: 18000, was: 23000, image: unsplash("photo-1774444052266-2e4b58d85c3b", 700), alt: "Natural linen lampshade", active: true },
    { productId: "marin-pleated-shade", name: "Marin Pleated Shade", category: "Lamp Shades", price: 22000, was: 28000, image: unsplash("photo-1494438639946-1ebd1d20bf85", 700), alt: "Pleated lampshade", active: true },
    { productId: "luna-pendant", name: "Luna Opal Pendant", category: "Pendant Lights", price: 58000, was: 70000, image: unsplash("photo-1507473885765-e6ed057f782c", 700), alt: "Opal glass pendant", active: true },
    { productId: "nora-table-lamp", name: "Nora Glass Table Lamp", category: "Table Lamps", price: 48000, was: 59000, image: unsplash("photo-1616486029423-aaa4789e8c9a", 700), alt: "Glass table lamp", active: true },
    { productId: "noor-velvet-shade", name: "Noor Velvet Lampshade", category: "Lamp Shades", price: 26000, was: 32000, image: unsplash("photo-1505693416388-ac5ce068fe85", 700), alt: "Velvet lampshade", active: true },
  ],
};
