import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Telenomily",
    short_name: "Telenomily",
    description: "Medication companion for the first week home.",
    start_url: "/patient",
    display: "standalone",
    background_color: "#4D50A2",
    theme_color: "#4D50A2",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
