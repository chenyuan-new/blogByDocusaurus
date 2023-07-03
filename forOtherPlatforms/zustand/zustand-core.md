# zustand 源码核心流程解析

> 此文章基于 zustand v4.3.8
> zustand 的[4.3.8 tags 链接](https://github.com/pmndrs/zustand/releases/tag/v4.3.8)，
> zustand 的[文档地址](https://docs.pmnd.rs/zustand/getting-started/introduction)

## 使用方式

`zustand`是基于发布订阅模式实现的一个状态管理库，可以不局限于仅在`react`项目中使用，不过对`react`的支持是官方实现的，使用起来也非常简洁，使用示例如下

```js
// 在js项目中使用，不需要类型
import { create } from "zustand";

const initStateCreateFunc = (set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
});

const useBearStore = create(initStateCreateFunc);
```

```ts
// ts项目，需要类型提示
import { create } from "zustand";

interface BearState {
  bears: number;
  increase: (by: number) => void;
}

const initStateCreateFunc = (set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
});

const useBearStore = create<BearState>()(initStateCreateFunc);
```

如上文代码，在调用`create`函数后，会生成一个`useStore`的 hook，这个 hook 基本的使用方式和`redux`的`useSelector`的一模一样

```js
function BearCounter() {
  const bears = useBearStore((state) => state.bears);
  return <h1>{bears} around here...</h1>;
}

function Controls() {
  const increase = useBearStore((state) => state.increase);
  return <button onClick={increase}>one up</button>;
}
```

> 细心地你可能发现 js 和 ts 的使用有不同，ts 是 create`<BearState>()(initStateCreateFunc)`，原因会在下文解释

## 源码主体流程

`zustand`的核心是将外部`store`和组件`view`的交互，交互的核心流程如下图

![zustand](/img/zustand.png)

先使用`create`函数基于注入的`initStateCreateFunc`创建一个闭包的`store`，并暴露对应的`subscribe`、`setState`、`getState`、~~`destory`~~(此 api 将被移除)这几个`api`

借助于`react`官方提供的`useSyncExternalStoreWithSelector`可以将`store`和`view`层绑定起来，从而实现使用外部的`store`来控制页面的展示。

`zustand`还支持了`middleware`的能力，采用`create(middleware(...args))`的形式即可使用对应的`middleware`

## 核心代码详解

这部分讲解最核心的`create`和`useSyncExternalStoreWithSelector`函数

### create 函数生成 store

> 为了便于阅读，代码有删减

#### 前置知识介绍

`create`函数生成的`store`是一个闭包，通过暴露`api`的方式实现对`store`的访问。

核心代码在`vanilla.ts`和`react.ts`这两个文件中，`vanilla.ts`里实现了一个完整的有`pub-sub`能力的`store`, 不需要依赖于`react`即可使用。

`react.ts`里基于`useSyncExternalStoreWithSelector`实现了一个`useStore`的 hook，在组件里调用`create`返回的函数时会将`store`和组件绑定起来，而这个绑定就是`useStore`实现的
这个`useSyncExternalStoreWithSelector`会在下一小节讲述。

#### create 运行流程

在`create`函数调用的时候，先使用`vanilla.ts`导出的`createStore`生成`store`，然后定义一个`useBoundStore`函数，返回值是`useStore(api, selector, equalityFn)`，然后把`createStore`返回的`api`注入`useBoundStore`上，然后返回`useBoundStore`.
这个`useBoundStore`的使用方式和`useSelector`一模一样

### 简化带注释源码

> 看代码会发现`createStore`和`create`这两个函数都是`(createState) => createState ? createStoreImpl(createState) : createStoreImpl`的形式，翻阅官方文档的[ts guide](https://docs.pmnd.rs/zustand/guides/typescript#basic-usage)，会发现官方在 ts 项目里的调用方式是这样的：`create()(...args)`

> 在文档代码示例下方有解释是为了处理[TypeScript/issues/10571](https://github.com/microsoft/TypeScript/issues/10571)而实现的一个 walkaround，这也是上文 ts 和 js 使用方式不一致的解答

```ts
// 生成store闭包，并返回api
// createState是使用者在创建store时传入的一个函数
const createStoreImpl = (createState) => {
  type TState = ReturnType<typeof createState>;
  type Listener = (state: TState, prevState: TState) => void;
  // 这里的state就是store，是个闭包，通过暴露的api访问
  let state: TState;
  const listeners: Set<Listener> = new Set();

  // setState的partial参数支持对象和函数，replace指明是全量替换store还是merge
  // 更新是浅比较
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    // 只有在相等的时候才更新，然后触发listener
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state =
        replace ?? typeof nextState !== "object"
          ? (nextState as TState)
          : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };

  const getState = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    // Unsubscribe
    return () => listeners.delete(listener);
  };

  // destory之后将被去掉，不用看
  const destroy: StoreApi<TState>["destroy"] = () => {
    if (import.meta.env?.MODE !== "production") {
      console.warn(
        "[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."
      );
    }
    listeners.clear();
  };

  const api = { setState, getState, subscribe, destroy };
  // 这里就是官方示例里的set,get,api
  state = createState(setState, getState, api);
  return api as any;
};

// 调用createStore的时候理论上createState函数是一定存在的
// 但是为了ts类型定义，createStore<T>()(()=>{}) 所以会出现手动调用空值的情况
export const createStore = ((createState) =>
  createState ? createStoreImpl(createState) : createStoreImpl) as CreateStore;
```

```ts
export function useStore<TState, StateSlice>(
  api: WithReact<StoreApi<TState>>,
  selector: (state: TState) => StateSlice = api.getState as any,
  equalityFn?: (a: StateSlice, b: StateSlice) => boolean
) {
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getServerState || api.getState,
    selector,
    equalityFn
  );
  useDebugValue(slice);
  return slice;
}

const createImpl = (createState) => {
  if (
    import.meta.env?.MODE !== "production" &&
    typeof createState !== "function"
  ) {
    console.warn(
      "[DEPRECATED] Passing a vanilla store will be unsupported in a future version. Instead use `import { useStore } from 'zustand'`."
    );
  }
  // 直接注入自定义的store不会注入api，需要自己在注入的store里自行实现
  const api =
    typeof createState === "function" ? createStore(createState) : createState;

  const useBoundStore: any = (selector?: any, equalityFn?: any) =>
    useStore(api, selector, equalityFn);

  Object.assign(useBoundStore, api);

  return useBoundStore;
};

export const create = (<T>(createState: StateCreator<T, [], []> | undefined) =>
  createState ? createImpl(createState) : createImpl) as Create;
```

### useSyncExternalStoreWithSelector 解析

`zustand`的核心代码如此简洁，一大原因就是使用了`useSyncExternalStoreWithSelector`，这个是`react`官方出的`use-sync-external-store/shim/with-selector`包，之所以出这个包，是因为`react`在提出[useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore#usage)这个 hook 后，在`react v18`版本做了重新实现，有破坏性更新。为了兼容性考虑出了这个包。

话不多说，上[源码](https://github.com/facebook/react/blob/main/packages/use-sync-external-store/src/useSyncExternalStoreWithSelector.js)

这个实现其实是基于官方的`useSyncExternalStore`做的一个封装，官方 hook 不支持传入`selector`，封装后支持了`selector`和`isEqual`。

`useSyncExternalStore`一定需要传入`subscribe`和`getSnapshot`两个函数，返回值是`getSnapshot`的返回结果。`react`会给`subscribe`注入一个`callback`函数，当外部`store`变化的时候，一定要手动的调用`callback`，通知`react`外部`store`变化了，需要它重新调用`getSnapshot`获取最新的状态，如果状态改变了就触发`re-render`，否则不`re-render`

`useSyncExternalStoreWithSelector`的优化主要是允许从一个大`store`中取出组件所用到的部分，同时借助`isEqual`来减少`re-render`的次数

```ts

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (() => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: void | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  // Use this to track the rendered snapshot.
  const instRef = useRef<
    | {
        hasValue: true,
        value: Selection,
      }
    | {
        hasValue: false,
        value: null,
      }
    | null,
  >(null);
  let inst;
  if (instRef.current === null) {
    inst = {
      hasValue: false,
      value: null,
    };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  /**
   * zustand使用的时候采用的是useStore(selector)的形式，每次re-render都会获得一个新的selector
   * 所以getSelection在re-render后都是新的，但是因为有instRef.current以及isEqual
   * 当isEqual的时候返回instRef.current缓存的值，也就是getSelection的返回值不变
   * 不会再次re-render，减少了re-render的次数
   *  */
  const [getSelection, getServerSelection] = useMemo(() => {
    // Track the memoized state using closure variables that are local to this
    // memoized instance of a getSnapshot function. Intentionally not using a
    // useRef hook, because that state would be shared across all concurrent
    // copies of the hook/component.
    let hasMemo = false;
    let memoizedSnapshot;
    let memoizedSelection: Selection;
    const memoizedSelector = (nextSnapshot: Snapshot) => {
      if (!hasMemo) {
        // The first time the hook is called, there is no memoized result.
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined) {
          // Even if the selector has changed, the currently rendered selection
          // may be equal to the new selection. We should attempt to reuse the
          // current value if possible, to preserve downstream memoizations.
          if (inst.hasValue) {
            const currentSelection = inst.value;
            if (isEqual(currentSelection, nextSelection)) {
              memoizedSelection = currentSelection;
              return currentSelection;
            }
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }

      // We may be able to reuse the previous invocation's result.
      const prevSnapshot: Snapshot = (memoizedSnapshot: any);
      const prevSelection: Selection = (memoizedSelection: any);

      if (is(prevSnapshot, nextSnapshot)) {
        // The snapshot is the same as last time. Reuse the previous selection.
        return prevSelection;
      }

      // The snapshot has changed, so we need to compute a new selection.
      const nextSelection = selector(nextSnapshot);

      // If a custom isEqual function is provided, use that to check if the data
      // has changed. If it hasn't, return the previous selection. That signals
      // to React that the selections are conceptually equal, and we can bail
      // out of rendering.
      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        return prevSelection;
      }

      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };
    // Assigning this to a constant so that Flow knows it can't change.
    const maybeGetServerSnapshot =
      getServerSnapshot === undefined ? null : getServerSnapshot;
    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector =
      maybeGetServerSnapshot === null
        ? undefined
        : () => memoizedSelector(maybeGetServerSnapshot());
    return [getSnapshotWithSelector, getServerSnapshotWithSelector];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(
    subscribe,
    getSelection,
    getServerSelection,
  );

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);

  useDebugValue(value);
  return value;
}
```
