// Bun text imports: `import css from "./x.css" with { type: "text" }`.
declare module "*.css" {
  const text: string;
  export default text;
}
