// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const { themes } = require("prism-react-renderer");

const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Chen yuan",
  tagline: "Always eager to learn",
  url: "https://chen-yuan-blog.vercel.app/",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  organizationName: "chen yuan", // Usually your GitHub org/user name.
  projectName: "blog", // Usually your repo name.
  plugins: ["@docusaurus/theme-live-codeblock"],
  i18n: {
    defaultLocale: "zh-Hans",
    locales: ["zh-Hans", "en"],
  },
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          showLastUpdateTime: true,
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          editUrl:
            "https://github.com/chenyuan-new/blogByDocusaurus/blob/main/",
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            "https://github.com/chenyuan-new/blogByDocusaurus/blob/main/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      docs: {
        sidebar: {
          hideable: true,
        },
      },
      announcementBar: {
        id: "support_us",
        content:
          '⭐️ 如果这个网站能帮助到你，欢迎给一个star支持作者  <a target="_blank" rel="noopener noreferrer" href="https://github.com/chenyuan-new/blogByDocusaurus">GitHub</a>',
        backgroundColor: "#fafbfc",
        textColor: "#091E42",
        isCloseable: true,
      },
      navbar: {
        title: "Chen yuan的博客",
        hideOnScroll: true,
        items: [
          {
            type: "search",
            position: "right",
          },
          {
            type: "doc",
            docId: "frontend/index",
            position: "right",
            label: "知识库",
          },
          { to: "blog", label: "Blog", position: "right" },
          { type: "localeDropdown", position: "right" },
          {
            href: "https://github.com/chenyuan-new/blogByDocusaurus",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      prism: {
        theme: darkCodeTheme,
        darkTheme: lightCodeTheme,
        defaultLanguage: "js",
        additionalLanguages: [
          "rust",
          "typescript",
          "markup",
          "css",
          "tsx",
          "jsx",
          "json",
        ],
      },
      colorMode: {
        respectPrefersColorScheme: true,
      },
      algolia: {
        // The application ID provided by Algolia
        appId: "4P8N3GM9K9",

        // Public API key: it is safe to commit it
        apiKey: "e6cfcacca2f69ee4177b2c74f1fa7376",

        indexName: "chen-yuan-vercel",
      },
    }),
};

module.exports = config;
