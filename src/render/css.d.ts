// Bun text imports: `import css from "./x.css" with { type: "text" }`.
declare module "*.css" {
  const text: string;
  export default text;
}

// Bun file imports: `import f from "./x.woff2" with { type: "file" }` gives a path, embedded by --compile.
declare module "*.woff2" {
  const path: string;
  export default path;
}
