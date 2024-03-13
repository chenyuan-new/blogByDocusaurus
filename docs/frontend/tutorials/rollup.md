# rollup 实战讲解

Rollup 是一个 JavaScript 模块打包工具，可以将多个小的代码片段编译为完整的库和应用。它采用 ES6 Modules 标准进行实现，打包产物可以按需引入。目前也支持打包 CommonJS 、UMD、IIFE、amd 等格式。目前 vite 的生产模式就是采用的 Rollup 进行打包。rollup 比较适合框架或者工具库的打包，在打包速度和配置的复杂度上较 webpack 有一定的优势，但在在用来打包复杂应用时，相较于 webpack 还是有一定的不足。

本文将基于 zustand 的打包配置来学习 rollup 的使用

## rollup 快速入门

### 命令行打包

最简单的打包方式是在安装 rollup 后使用命令行进行简单的打包

```bash
# 单文件打包
rollup src/main.js -o bundle.js -f cjs

#多文件打包
rollup src/main.js src/index.js xxx -o bundle.js -f cjs
```

`-o`指定输出文件名，如果不设置则只会将打包结果打印在命令行里，不会输出到文件中；`-f`指明了输出的格式。详细的命令行参数看这里[命令行参数表](https://rollupjs.org/command-line-interface/#command-line-flags)

### 配置文件

就像 babel、eslint、webpack 等工具一样，rollup 也支持通过读取配置文件的形式进行打包设置。配置文件常见用名是`rollup.config.js`，使用也很简单

```bash
# 配置文件名是 rollup.config.js 等 可以省略后续的文件名
# 会按照下面的顺序进行查找
# rollup.config.mjs -> rollup.config.cjs -> rollup.config.js
rollup -c/--config [config file name]
```

简单的配置文件内容如下，这是采用 es6 module 的写法，也可以用 cjs 的写法。如果想使用 ts 的话，需要安装插件`@rollup/plugin-typescript` ，然后运行命令
`rollup -c rollup.config.ts --configPlugin typescript` 具体的介绍可以看这个[configPlugin](https://rollupjs.org/command-line-interface/#configplugin-plugin)

不是很推荐使用 ts 当配置文件，如果需要类型提示可以参考[config-intellisense](https://rollupjs.org/command-line-interface/#config-intellisense)进行设置。

```js
export default {
  input: "src/main.js",
  output: {
    file: "bundle.js",
    format: "cjs",
  },
};
```

配置文件支持导出数组类型的配置，这样可以一次进行多种要求的打包

```js
// rollup.config.js (building more than one bundle)

export default [
  {
    input: "main-a.js",
    output: {
      file: "dist/bundle-a.js",
      format: "cjs",
    },
  },
  {
    input: "main-b.js",
    output: [
      {
        file: "dist/bundle-b1.js",
        format: "cjs",
      },
      {
        file: "dist/bundle-b2.js",
        format: "es",
      },
    ],
  },
];
```

配置文件也可写成一个函数的形式，它接受命令行参数

```js
// rollup.config.js
import defaultConfig from "./rollup.default.config.js";
import debugConfig from "./rollup.debug.config.js";

export default (commandLineArgs) => {
  if (commandLineArgs.configDebug === true) {
    return debugConfig;
  }
  return defaultConfig;
};
```

对应的命令行是`rollup --config --configDebug`，获取到的命令行参数就是

```js
commandLineArgs:{
  config: true,
  configDebug: true,
}
```

### 插件

rollup 自身只有 esmodule 打包的功能，如果需要更高级的功能的话，需要引入 plugin。不像 webpack 有 loader、plugin 等扩展方式，rollup 只有 plugin 一种扩展方式。

#### 常见的 plugin 介绍

##### @rollup/plugin-json

使用此插件后可以直接导入`.json`文件，读取里面的值。官方示例如下

```js
// src/main.js
import { version } from "../package.json";
export default function () {
  console.log("version " + version);
}

// rollup.config.js
import json from '@rollup/plugin-json';
export default {
	input: 'src/main.js',
	output: {
		file: 'bundle.js',
		format: 'cjs'
	},
	plugins: [json()]
};

// output
'use strict';
var version = '1.0.0';
function main() {
	console.log('version ' + version);
}
module.exports = main;
```

##### @rollup/plugin-node-resolve

在浏览器里，是无法解析`import foo from 'foo'`这个语句的，无法找到`foo`这个包，在 node 中使用这个不报错是因为寻找`foo`的算法在 node 中进行了实现。
[readme](https://github.com/rollup/plugins/blob/master/packages/node-resolve/README.md) 可以这样使用`resolve({extensions:['.mjs', '.js', '.json', '.node']})`指定插件起作用的文件类型

##### @rollup/plugin-commonjs

这个包的作用是将 commonjs 的包转换成 esmodule 的形式，可以使用 import 语句进行导入

##### @rollup/plugin-babel

使用这个包可以进行代码的转译，比如从 es6 转译成 es5，但是要注意需要在代码里配置`.babelrc.json`文件(`babel.config.js`也可，两者的区别可以看这篇[文章](https://zhuanlan.zhihu.com/p/367724302))

### 代码分割

代码分割可以看官方的[code-splitting](https://rollupjs.org/tutorial/#code-splitting)；简单来说就是采用了 esmodule 的`import(..).then()`懒加载模式的模块，会被自动分割成一个单独的模块，不会和它被导入部分的代码打包到一起。

简单示例

```js
// src/main.js
export default function () {
  import("./foo.js").then(({ default: foo }) => console.log(foo));
}
```

使用如下命令

```bash
rollup src/main.js -f cjs -d dist
```

可以得到如下结果

```js
//→ main.js:
"use strict";

function main() {
  Promise.resolve(require("./chunk-b8774ea3.js")).then(({ default: foo }) =>
    console.log(foo)
  );
}

module.exports = main;

//→ chunk-b8774ea3.js:
("use strict");

var foo = "hello world!";

exports.default = foo;
```

## 以 zustand 为例学习 rollup 打包

前文已经介绍了 rollup 有关的基础知识，接下来就从 zustand 的打包配置来学习实际的 lib 库是如何打包的

### 前置相关内容

#### 相关插件

##### @rollup/plugin-typescript

[@rollup/plugin-typescript](https://github.com/rollup/plugins/blob/master/packages/typescript/README.md) 插件的作用是将 rollup 和 typescript 结合起来，入参包含 tsconfig.json 里的 compilerOptions 和一些其他定制参数

##### @rollup/plugin-alias

[@rollup/plugin-alias](https://github.com/rollup/plugins/blob/master/packages/alias/README.md)是别名插件，像下文例子所示，配置之后就可以使用`import utils from 'utils'`而不是`'../../../utils'`了

```js
import alias from "@rollup/plugin-alias";

  plugins: [
    alias({
      entries: [
        { find: "utils", replacement: "../../../utils" },
        { find: "batman-1.0.0", replacement: "./joker-1.5.0" },
      ],
    }),
  ],
```

##### @rollup/plugin-replace

[readme](https://github.com/rollup/plugins/blob/master/packages/replace/README.md)说明这个插件的作用是在打包的时候进行字符串替换。

```js
import replace from "@rollup/plugin-replace";

plugins: [
  replace({
    "process.env.NODE_ENV": JSON.stringify("production"),
    __buildDate__: () => JSON.stringify(new Date()),
    __buildVersion: 15,
  }),
];
```

#### 配置项

##### external

该选项用于匹配需要保留在 bundle 外部的模块，它的值可以是一个接收模块 id 参数并且返回 true（表示排除）或 false（表示包含）的函数，也可以是一个由模块 ID 构成的数组，还可以是可以匹配到模块 ID 的正则表达式。除此之外，它还可以是单个模块 ID 或者单个正则表达式。匹配得到的模块 ID 应该满足以下条件之一：

- import 语句中外部依赖的名称。例如，如果标记 import "dependency.js" 为外部依赖，那么模块 ID 为 "dependency.js"，而如果标记 import "dependency" 为外部依赖，那么模块 ID 为 "dependency"。
- 绝对路径。（例如，文件的绝对路径）

当 external 是一个函数时，它会提供三个参数 (`id, parent, isResolved`)

id 值为相关模块的 id
parent 值为执行 import 的模块的 id
isResolved 值为布尔值，指是否已经通过插件等方式解决模块依赖

```js
// rollup.config.js
import { fileURLToPath } from "node:url";

export default {
  //...,
  external: [
    "some-externally-required-library",
    fileURLToPath(
      new URL(
        "src/some-local-file-that-should-not-be-bundled.js",
        import.meta.url
      )
    ),
    /node_modules/,
  ],
};
```

##### output

- esModule
  该选项用于决定是否在生成非 ES 格式导出时添加 `__esModule: true` 属性。

- intro/outro
  除了在特定格式中代码不同外，该选项功能和 output.banner/output.footer 类似,用于在 bundle 前或后添加字符串

- globals
  类型为 `{ [id: string]: string }| ((id: string) => string)`，用于在 umd / iife bundle 中，使用 将模块 id 和全局变量绑定起来，比如`{jquery:"$"}`

- name
  输出格式为 iife / umd 的 bundle 来说，若想要使用全局变量名来表示你的 bundle 时，该选项是必要的。同一页面上的其他脚本可以使用这个变量名来访问你的 bundle 输出。

### 正文

先看打包的命令

```json
"build:base": "rollup -c",
"build:vanilla": "rollup -c --config-vanilla",
"build:middleware": "rollup -c --config-middleware",
"build:middleware:immer": "rollup -c --config-middleware_immer",
"build:shallow": "rollup -c --config-shallow",
"build:context": "rollup -c --config-context",
```

接下来看下`rollup.config.js`里的配置，可以发现采用的是返回数组的形式，一次打包多种格式的产物；可以看到没有对`react.ts`文件进行单独的打包，这是因为`react.ts`不需要单独导出，对`index.ts`打包即可。

```js
const extensions = [".js", ".ts", ".tsx"];

module.exports = function (args) {
  let c = Object.keys(args).find((key) => key.startsWith("config-"));
  if (c) {
    // replace针对的是build:middleware:immer，转换成middleware/immer
    c = c.slice("config-".length).replace(/_/g, "/");
  } else {
    c = "index";
  }
  return [
    ...(c === "index" ? [createDeclarationConfig(`src/${c}.ts`, "dist")] : []),
    createCommonJSConfig(`src/${c}.ts`, `dist/${c}`, {
      addModuleExport: {
        index: {
          default: "react",
          create: "create",
          useStore: "useStore",
          createStore: "vanilla.createStore",
        },
        vanilla: { default: "vanilla", createStore: "createStore" },
        shallow: { default: "shallow$1", shallow: "shallow" },
      }[c],
    }),
    createESMConfig(`src/${c}.ts`, `dist/esm/${c}.js`),
    createESMConfig(`src/${c}.ts`, `dist/esm/${c}.mjs`),
    createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, "development"),
    createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, "production"),
    createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, "development"),
    createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, "production"),
  ];
};
```

下面就是对于引用函数的详细介绍了，因为大量配置重复，所以只介绍比较重要的几个。

- `createDeclarationConfig`

```js
const typescript = require("@rollup/plugin-typescript");
function createDeclarationConfig(input, output) {
  return {
    input,
    output: {
      dir: output,
    },
    external,
    plugins: [
      // 如函数名，只生成type
      typescript({
        declaration: true,
        emitDeclarationOnly: true,
        outDir: output,
      }),
    ],
  };
}
```

- `createESMConfig`

```js
const resolve = require("@rollup/plugin-node-resolve");
const { root } = path.parse(process.cwd());

// 外部npm包都external掉
function external(id) {
  // 这个判断其实没必要!id.startsWith(".")，因为入参是绝对路径
  return !id.startsWith(".") && !id.startsWith(root);
}

function getEsbuild(target, env = "development") {
  return esbuild({
    minify: env === "production",
    target,
    tsconfig: path.resolve("./tsconfig.json"),
  });
}

function createESMConfig(input, output) {
  return {
    input,
    output: { file: output, format: "esm" },
    external,
    plugins: [
      // const entries = [{ find: /.*\/vanilla\.ts$/, replacement: "zustand/vanilla" }];

      alias({ entries: entries.filter((e) => !e.find.test(input)) }),
      resolve({ extensions }),
      replace({
        ...(output.endsWith(".js")
          ? {
              "import.meta.env?.MODE": "process.env.NODE_ENV",
            }
          : {
              "import.meta.env?.MODE":
                "(import.meta.env && import.meta.env.MODE)",
            }),
        // a workround for #829
        "use-sync-external-store/shim/with-selector":
          "use-sync-external-store/shim/with-selector.js",
        // 这个的作用是在正则匹配的时候作为字符串的边界
        delimiters: ["\\b", "\\b(?!(\\.|/))"],
        // 在进行赋值操作的时候，不会替换字符串
        // 在true的时候，process.env.DEBUG = false;不会被替换
        preventAssignment: true,
      }),
      // 使用esbuild进行编译，不minify
      getEsbuild("node12"),
    ],
  };
}
```

- `createCommonJSConfig`

```js
function getBabelOptions(targets) {
  return {
    ...createBabelConfig({ env: (env) => env === "build" }, targets),
    extensions,
    comments: false,
    babelHelpers: "bundled",
  };
}

function createCommonJSConfig(input, output, options) {
  return {
    input,
    output: {
      file: `${output}.js`,
      format: "cjs",
      esModule: false,
      // 手动添加commonjs导出
      outro: options.addModuleExport
        ? [
            `module.exports = ${options.addModuleExport.default};`,
            ...Object.entries(options.addModuleExport)
              .filter(([key]) => key !== "default")
              .map(([key, value]) => `module.exports.${key} = ${value};`),
            `exports.default = module.exports;`,
          ].join("\n")
        : "",
    },
    external,
    plugins: [
      alias({ entries: entries.filter((e) => !e.find.test(input)) }),
      resolve({ extensions }),
      replace({
        "import.meta.env?.MODE": "process.env.NODE_ENV",
        delimiters: ["\\b", "\\b(?!(\\.|/))"],
        preventAssignment: true,
      }),
      babelPlugin(getBabelOptions({ ie: 11 })),
    ],
  };
}
```

- `createUMDConfig`

```js
function createUMDConfig(input, output, env) {
  let name = "zustand";
  const fileName = output.slice("dist/umd/".length);
  const capitalize = (s) => s.slice(0, 1).toUpperCase() + s.slice(1);
  if (fileName !== "index") {
    name += fileName.replace(/(\w+)\W*/g, (_, p) => capitalize(p));
  }
  return {
    input,
    output: {
      file: `${output}.${env}.js`,
      format: "umd",
      name,
      globals: {
        react: "React",
        immer: "immer",
        // FIXME not yet supported
        "use-sync-external-store/shim/with-selector":
          "useSyncExternalStoreShimWithSelector",
        "zustand/vanilla": "zustandVanilla",
      },
    },
    external,
    plugins: [
      alias({ entries: entries.filter((e) => !e.find.test(input)) }),
      resolve({ extensions }),
      replace({
        "import.meta.env?.MODE": JSON.stringify(env),
        delimiters: ["\\b", "\\b(?!(\\.|/))"],
        preventAssignment: true,
      }),
      babelPlugin(getBabelOptions({ ie: 11 })),
      ...(env === "production" ? [terser()] : []),
    ],
  };
}
```
