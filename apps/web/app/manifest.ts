import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TableFolk — Virtual Board Game Café",
    short_name: "TableFolk",
    description:
      "Meet friends in a cozy top-down virtual board game café and play multiplayer tabletop games like Treasure Trails.",
    start_url: "/cafe",
    display: "standalone",
    background_color: "#FAF4EA",
    theme_color: "#5A9367",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
