# use-context-selector 源码讲解

> 本文基于[1.4.1 版本](https://github.com/dai-shi/use-context-selector/releases/tag/v1.4.1)

> 参考文章：[从 0 实现 use-context-selector](https://juejin.cn/post/7197972831795380279)

## use-context-selector 介绍

[use-context-selector](https://github.com/dai-shi/use-context-selector/tree/v1.4.1)是为了解决 react 提供的[useContext](https://react.dev/reference/react/useContext) hook 的这个问题：一旦 context 的某个 value 更新了(如 context.a)，所有使用 useContext 的组件都会更新，即便它只订阅了 context.b

use-context-selector 的使用方式和 useContext 一模一样，下面的是官方示例，从示例中可以注意到一个问题：
StateProvider 组件生成 value 用的是 setState，那在 Counter1 组件里更新 count1 的时候会触发 StateProvider 里的 state 更新，进而导致 StateProvider 更新，react 里父组件渲染会导致所有的子组件也重新渲染，那这样所有的子组件(Count1 Count2)不就都会更新了吗？

实际测试下来发现并不会，原因的话可以看看这篇[post](https://www.developerway.com/posts/react-elements-children-parents)，讲的非常详细，对应的问题也都描述的很清楚。
简单的给个结论：**子组件写在哪个组件里，那就是哪个组件的子组件**(如果是使用`{()=><Child/>}`形式在父组件里写入的，则不是)；在下面的例子里，对 StateProvider 来说，Count1 Count2 并不是它的子组件，它们是 App 的子组件，所以不会因为 StateProvider 的 re-render 而导致包含的所有的子组件都 re-render

```jsx
import { createContext, useContextSelector } from "use-context-selector";

const context = createContext(null);

const Counter1 = () => {
  const count1 = useContextSelector(context, (v) => v[0].count1);
  const setState = useContextSelector(context, (v) => v[1]);
  const increment = () =>
    setState((s) => ({
      ...s,
      count1: s.count1 + 1,
    }));
  return (
    <div>
      <span>Count1: {count1}</span>
      <button type="button" onClick={increment}>
        +1
      </button>
      {Math.random()}
    </div>
  );
};

const Counter2 = () => {
  const count2 = useContextSelector(context, (v) => v[0].count2);
  const setState = useContextSelector(context, (v) => v[1]);
  const increment = () =>
    setState((s) => ({
      ...s,
      count2: s.count2 + 1,
    }));
  return (
    <div>
      <span>Count2: {count2}</span>
      <button type="button" onClick={increment}>
        +1
      </button>
      {Math.random()}
    </div>
  );
};

const StateProvider = ({ children }) => (
  <context.Provider value={useState({ count1: 0, count2: 0 })}>
    {children}
  </context.Provider>
);

const App = () => (
  <StateProvider>
    <Counter1 />
    <Counter2 />
  </StateProvider>
);

ReactDOM.render(<App />, document.getElementById("app"));
```

## 源码讲解

use-context-selector 的实现思想也是订阅模式，为什么这样说呢，且听我娓娓道来。
先说下整体的思路：基于原生的 createContext、useContext 和 Provider 进行封装，把 Provider 的 value 改成 ref 的形式(contextValue)，这样可以保证 useContext 获取到的引用不变，然后根据用户自身实现的 selector 获取到对应的值，如果前后对比值有变动就调用 useReducer 的 dispatch 触发组件的渲染。
之所以说是发布订阅模式，是因为在使用 useContextSelector 之后会将对应组件里的 dispatch 放到 contextValue 的 listener 里，当 context 的 value 更新后，会触发 listener 里的 dispatch，从而实现各组件的更新

### createProvider

封装后的 contextValue 是下面的形式，update 函数用来进行`batch update`，listeners 存放各个调用 useContextSelector 后存入的 dispatch，用来在 ContextProvider 的 value 更新的时触发各组件的更新

```ts
contextValue.current = {
  [CONTEXT_VALUE]: {
    /* "v"alue     */ v: valueRef,
    /* versio"n"   */ n: versionRef,
    /* "l"isteners */ l: listeners,
    /* "u"pdate    */ u: update,
  },
};
```

```ts
const createProvider = <Value>(ProviderOrig: Provider<ContextValue<Value>>) => {
  const ContextProvider = ({
    value,
    children,
  }: {
    value: Value;
    children: ReactNode;
  }) => {
    const valueRef = useRef(value);
    const versionRef = useRef(0);
    // 为了和suspense更好的结合而引入的，下文会讲
    const [resolve, setResolve] = useState<((v: Value) => void) | null>(null);
    if (resolve) {
      resolve(value);
      setResolve(null);
    }
    const contextValue = useRef<ContextValue<Value>>();
    // 初始化
    if (!contextValue.current) {
      const listeners = new Set<Listener<Value>>();
      // 这个的作用是强制采用batch update，不需要的时候不用调用这个update
      const update = (thunk: () => void, options?: { suspense: boolean }) => {
        batchedUpdates(() => {
          // do xxx
          listeners.forEach((listener) => listener(action));
          thunk();
        });
      };
      contextValue.current = {
        [CONTEXT_VALUE]: {
          /* "v"alue     */ v: valueRef,
          /* versio"n"   */ n: versionRef,
          /* "l"isteners */ l: listeners,
          /* "u"pdate    */ u: update,
        },
      };
    }
    // 每次value更新就调用注入的listener, 也就是通过useContextSelector注入的dispatch
    useIsomorphicLayoutEffect(() => {
      valueRef.current = value;
      versionRef.current += 1;
      // 通过react的scheduler封装的函数，按照优先级调用listener，可以不关注
      runWithNormalPriority(() => {
        (contextValue.current as ContextValue<Value>)[CONTEXT_VALUE].l.forEach(
          (listener) => {
            listener({ n: versionRef.current, v: value });
          }
        );
      });
    }, [value]);
    return createElement(
      ProviderOrig,
      { value: contextValue.current },
      children
    );
  };
  return ContextProvider;
};
```

#### update 函数

Provier 里有个`[resolve, setResolve]`还有 update 函数，update 函数可以将多次 setState 合并成一次 render，这样避免了不必要的性能损耗(react18 自动携带了这个特性，17 及之前在 promise 和 setTimeout 之类的函数里不会合并，event handler 里还是自动合并的)。

`setResolve`这个只在开了`{suspense:true}`的时候才会使用，这是为了**更好的和`Suspense`组件结合**，在 dispatch 也就是调用`listener(action)`的时候，如果存在`action.p`，则会`throw action.p`。**`Supsense`接收到抛出的`Promise`后会渲染 fallback**，当这个`Promise`被 resolve 后会渲染真正的组件。

```ts
const update = (thunk: () => void, options?: { suspense: boolean }) => {
  batchedUpdates(() => {
    versionRef.current += 1;
    const action: Parameters<Listener<Value>>[0] = {
      n: versionRef.current,
    };
    // 开启这个后所有useSelector对应的父suspense都fallback了
    if (options?.suspense) {
      action.n *= -1; // this is intentional to make it temporary version
      action.p = new Promise<Value>((r) => {
        setResolve(() => (v: Value) => {
          action.v = v;
          delete action.p;
          r(v);
        });
      });
    }
    listeners.forEach((listener) => listener(action));
    thunk();
  });
};
```

### createContext

这个函数作用就是用 react 的`createContext`生成 context 之后，把 Provider 改成封装的，然后删除 Consumer 函数，不支持类组件

```ts
export function createContext<Value>(defaultValue: Value) {
  // 这个初始默认值不会被修改，只有在useContext的上层不存在Provider的时候才会读取这个默认值
  const context = createContextOrig<ContextValue<Value>>({
    [CONTEXT_VALUE]: {
      /* "v"alue     */ v: { current: defaultValue },
      /* versio"n"   */ n: { current: -1 },
      /* "l"isteners */ l: new Set(),
      /* "u"pdate    */ u: (f) => f(),
    },
  });
  (
    context as unknown as {
      [ORIGINAL_PROVIDER]: Provider<ContextValue<Value>>;
    }
  )[ORIGINAL_PROVIDER] = context.Provider;
  (context as unknown as Context<Value>).Provider = createProvider(
    context.Provider
  );
  // 只支持函数式组件，hooks写法
  delete (context as any).Consumer; // no support for Consumer
  return context as unknown as Context<Value>;
}
```

### useContextSelector

这部分的主要逻辑就是取出 contextValue 这个 ref，然后用 selector 计算出最新的 selected，和当前存放的 state 进行对比，不相等立刻调用 dispatch 重新渲染

这里有一个问题，如果是 context 的 value 改变，然后调用 dispatch(action)触发的渲染，即便计算出的结果是 selected 没有改变，在 react18 的时候也会重新运行一遍组件里的函数，除了不会真的进行渲染，也就是触发`useEffect、useLayoutEffect`。

```ts
export function useContextSelector<Value, Selected>(
  context: Context<Value>,
  selector: (value: Value) => Selected
) {
  const contextValue = useContextOrig(
    context as unknown as ContextOrig<ContextValue<Value>>
  )[CONTEXT_VALUE];
  if (typeof process === "object" && process.env.NODE_ENV !== "production") {
    if (!contextValue) {
      throw new Error("useContextSelector requires special context");
    }
  }
  const {
    /* "v"alue     */ v: { current: value },
    /* versio"n"   */ n: { current: version },
    /* "l"isteners */ l: listeners,
  } = contextValue;
  const selected = selector(value);
  const [state, dispatch] = useReducer(
    (
      prev: readonly [Value, Selected],
      action?: Parameters<Listener<Value>>[0]
    ) => {
      if (!action) {
        // case for `dispatch()` below
        return [value, selected] as const;
      }
      // FIXME 不允许有Promise value
      // suspense接收到一个throw 的promise就会fallback
      if ("p" in action) {
        throw action.p;
      }
      if (action.n === version) {
        if (Object.is(prev[1], selected)) {
          return prev; // bail out
        }
        // 这种也是新值了，应该要render，不过selected都不等了，render也正常
        return [value, selected] as const;
      }
      try {
        if ("v" in action) {
          // context更新后，需要对比最新的value action.v 和contextselector获取到的value是否一致，否则需要在selected改变时更新下
          if (Object.is(prev[0], action.v)) {
            return prev; // do not update
          }
          const nextSelected = selector(action.v);
          if (Object.is(prev[1], nextSelected)) {
            return prev; // do not update
          }
          return [action.v, nextSelected] as const;
        }
      } catch (e) {
        // ignored (stale props or some other reason)
      }
      return [...prev] as const; // schedule update
    },
    [value, selected] as const
  );
  if (!Object.is(state[1], selected)) {
    // schedule re-render
    // this is safe because it's self contained
    dispatch();
  }
  // 这里的listeners正常使用不会变，所以也就挂载的时候调用一次，add dispatch
  useIsomorphicLayoutEffect(() => {
    listeners.add(dispatch);
    return () => {
      listeners.delete(dispatch);
    };
  }, [listeners]);
  return state[1];
}
```

## use-context-selector 存在的问题

介绍完了源码，那么是否存在一些问题呢？其实啊，还真有一些问题：

1. 如果 selector 返回的是一个对象的话，那么使用 Object.is 进行判断，每次都是新的对象，会重新渲染
2. 在 react18，调用 dispatch，即便返回值没变，也会运行一遍组件里的代码，浪费了一定的性能
3. 在官方示例中，如果 Counter1 和 Counter2 组件之间来回点击 add count1 和 add count2 按钮，即使每次点击只更改 count1 或 count2，但 Counter1 和 Counter2 组件都会重新渲染。

问题 3 涉及了 react 的原理：react 中，一个组件会有两个 fiber，一个是 current fiber，一个是接下来要更新成的 fiber，wip fiber。当组件触发更新后，会在组件对应的两个 fiber 上都标记需要更新。当组件 render 完成后，会把 wip fiber 上的更新标记清除。当视图完成渲染后，current fiber 与 wip fiber 会交换位置，wip fiber 就变成了下次的 current fiber。当前的 current fiber 就变成了 wip fiber。注意，这个 wip fiber 的更新标记没有被清除！如果下次此组件有更新，则会重新构建 wip fiber，否则，就会基于当前的 wip fiber 进行构建。
当我们第一次点击 add count1 的时候，Counter1 组件对应 current fiber 和 wip fiber 同时标记更新。组件渲染完成后，wip fiber 的更新标记被清除，但此时 current fiber 还存在更新标记。完成渲染后，current fiber 和 wip fiber 会互换位置。此时变成了：wip fiber 存在更新，current fiber 不存在更新。
当点击 add count2 的时候，由于 Counter1 组件的 wip fiber 存在更新，所以即使本次没有修改 count1，但 Counter1 组件仍然会重新渲染，就出现了 Counter1 和 Counter2 组件同时重新渲染的情况。这里的渲染指的是组件运行，也就是 render，但是不 commit，也就是不触发`useEffect`这些，效果其实和问题 2 的 dispatch 是一致的。

问题 1 其实好处理，增加一个`isEqualFn`就好了，主要是问题 2、3 不好处理。
对于问题 1 给个简单的例子：

```js
export const useSelectedContext = (ctx, selector, eqlFn) => {
  const prevValue = useRef(null);
  const patchedSelector = (state) => {
    const nextValue = selector(state);
    if (eqlFn(prevValue.current, nextValuue)) {
      return prevValue.current;
    }
    return (prevValue.current = nextValue);
  };
  return useContextSelector(ctx, patchedSelector);
};
```

想解决问题 2、3 那就要换方法了，需要用到另一个 hook `useSyncExternalStore`
下面是简单的处理方案：

首先是 createProvider, 调用 listener 的时候不用传参数了，这里的 listener 是 react 注入的用来触发组件更新的函数，基本等价于 dispatch，但是不需要参数

```ts
const createProvider = <Value>(ProviderOrig: Provider<ContextValue<Value>>) => {
  const ContextProvider = ({
    value,
    children,
  }: {
    value: Value;
    children: ReactNode;
  }) => {
    const valueRef = useRef(value);
    const contextValue = useRef<ContextValue<Value>>();
    // 初始化
    if (!contextValue.current) {
      const listeners = new Set<Listener<Value>>();
      // 这个的作用是强制采用batch update，不需要的时候不用调用这个update
      const update = (thunk: () => void, options?: { suspense: boolean }) => {
        batchedUpdates(() => {
          // do xxx
          listeners.forEach((listener) => listener());
          thunk();
        });
      };
      contextValue.current = {
        [CONTEXT_VALUE]: {
          /* "v"alue     */ v: valueRef,
          /* "l"isteners */ l: listeners,
        },
      };
    }
    useIsomorphicLayoutEffect(() => {
      valueRef.current = value;
      runWithNormalPriority(() => {
        (contextValue.current as ContextValue<Value>)[CONTEXT_VALUE].l.forEach(
          (listener) => {
            listener();
          }
        );
      });
    }, [value]);
    return createElement(
      ProviderOrig,
      { value: contextValue.current },
      children
    );
  };
  return ContextProvider;
};
```

借助于 useSyncExternalStore 实现页面的更新

```ts
export function useContextSelector<Value, Selected>(
  context: Context<Value>,
  selector: (value: Value) => Selected,
  equalityFn = shallowEqual
) {
  const contextValue = useContextOrig(
    context as unknown as ContextOrig<ContextValue<Value>>
  )[CONTEXT_VALUE];
  if (typeof process === "object" && process.env.NODE_ENV !== "production") {
    if (!contextValue) {
      throw new Error("useContextSelector requires special context");
    }
  }
  const {
    /* "v"alue     */ v: { current: value },
    /* "l"isteners */ l: listeners,
  } = contextValue;

  const subscribe = useCallback(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    [listeners]

  const selected = selector(value);


  const lastSnapshot = useRef(selector(value));

  const getSnapshot = () => {
    const nextSnapshot = selector(contextValue.value);

    if (equalityFn(lastSnapshot.current, nextSnapshot)) {
      return lastSnapshot.current;
    }

    lastSnapshot.current = nextSnapshot;
    return nextSnapshot;
  };

  return useSyncExternalStore(subscribe, getSnapshot);
}
```

## 总结

本文分析了 use-context-selector 的主要内容，并指出了存在的一些问题及处理方式。
看这个的源码主要是学习发布订阅的使用思路。从现在的角度看，这个库目前存在一些问题应该被解决，但是在当时并没有那么多的问题，或者是没有更好地处理思路。
在我看来，目前这个库已经基本算是进入维护阶段了，改动不大，在轻量级的数据管理时可以考虑下这个库，但如果是重度依赖状态的话，建议使用 use-context-selector 作者的新作品：zustand、jotai 等；zustand 就是依赖于`useSyncExternalStore`实现的将外部状态和组件相绑定。
