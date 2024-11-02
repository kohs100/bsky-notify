export default {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  trailingComma: "es5",
  tabWidth: 2,
  semi: true,
  arrowParens: "avoid",
  printWidth: 80,
  importOrder: ["^lodash", "<THIRD_PARTY_MODULES>", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
