# zustand 插件介绍

本文是对前文的一个补充，以`persist`插件为例介绍`zustand`的中间件系统

`zustand`的核心代码实现的非常简洁，功能特性也相对较少。如果想要有更多的特性就需要自行实现或者通过引入中间件的方式使用现有的轮子。

## zustand 中间件的本质

如官方文档[middlware](https://docs.pmnd.rs/zustand/recipes/recipes#middleware)介绍，`zustand`的中间件实际上是一个高阶函数，它的入参和`create`函数相同，都是`createInitState`类的函数，但是不同的是它的返回值仍然是一个`createInitState`类的函数，本质上是对`createInitState`做了一层包裹，注入特定的逻辑，实现对`createInitState`的改写。

```js
import { create } from "zustand";

const createInitState = (set) => ({
  bees: false,
  setBees: (input) => set((state) => void (state.bees = input)),
});
// no middleware
const useStore = create(createInitState);

// with middleware
const useStoreWithMiddleware = create(
  middleware1(middleware2(createInitState))
);
```

## persist 中间件源码详解

persist 中间件的详细介绍可以看[persist](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)

入参是`createInitState`和`options`，其中`options.name`必传，其他的都是可选项，`options`的默认值是这些

```js
defaultOptions = {
    storage: createJSONStorage<S>(() => localStorage),
    // 决定保存state里的哪些数据
    partialize: (state: S) => state,
    version: 0,
    // 决定如何merge现有数据和保存在storage里的的数据
    merge: (persistedState: unknown, currentState: S) => ({
      ...currentState,
      ...(persistedState as object),
    }),
}

```

可以看到最开始的时候调用了`createJSONStorage`函数来生成 storage, 从我的理解，这个函数的作用是做一个胶水层，使得`getItem`支持`async storage`，核心在于

```ts
const str = (storage as StateStorage).getItem(name) ?? null;
// support async storage
if (str instanceof Promise) {
  return str.then(parse);
}
return parse(str);
```

从`createJSONStorage`函数可以看出 persist 中间件最开始应该是基于`localStorage`进行的封装，后来进行的拓展，数据的存储都需要使用 string。可以看到存在这样一个问题： `setItem`并未支持`async storage`，没有做`await`的操作，调用后不管是否完成，这与`getItem`不一致。不过换个思路，其实也没必要保证`setItem`完成，因为一般不会在`setItem`后立刻执行`getItem`，`await`的话会损失一部分性能。但是从我的角度还是`await`下比较好。

`createJSONStorage`源码见下：

```ts
export interface StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

export function createJSONStorage<S>(
  getStorage: () => StateStorage,
  options?: JsonStorageOptions
): PersistStorage<S> | undefined {
  let storage: StateStorage | undefined;
  try {
    storage = getStorage();
  } catch (e) {
    // prevent error if the storage is not defined (e.g. when server side rendering a page)
    return;
  }
  const persistStorage: PersistStorage<S> = {
    getItem: (name) => {
      const parse = (str: string | null) => {
        if (str === null) {
          return null;
        }
        return JSON.parse(str, options?.reviver) as StorageValue<S>;
      };
      const str = (storage as StateStorage).getItem(name) ?? null;
      // 支持 async storage
      if (str instanceof Promise) {
        return str.then(parse);
      }
      return parse(str);
    },
    setItem: (name, newValue) =>
      (storage as StateStorage).setItem(
        name,
        JSON.stringify(newValue, options?.replacer)
      ),
    removeItem: (name) => (storage as StateStorage).removeItem(name),
  };
  return persistStorage;
}
```

下面的是核心源码(`hydrate`函数的内容被省略了，在下一步介绍。
)，可以看到在 zustand 原有的 api 上挂在了一个`api.persist`用来暴露 persist 的 api，最终的返回值也是`createInitState`(也就是 config)的返回值 initState

可以看到`options.skipHydration`和`hydrate`函数，这个函数的作用是将保存的 state 和现有的 state merge 到一起，就类似于`SSR`的水和，将事件挂载到相应的 dom 上。

```ts
const newImpl = (config, baseOptions) => (set, get, api) => {
  // 这里的S其实就是上文的createInitState的返回值的类型
  type S = ReturnType<typeof config>;
  let options = {
    storage: createJSONStorage<S>(() => localStorage),
    partialize: (state: S) => state,
    version: 0,
    merge: (persistedState: unknown, currentState: S) => ({
      ...currentState,
      ...(persistedState as object),
    }),
    // above are default configs
    ...baseOptions,
  };

  let hasHydrated = false;
  const hydrationListeners = new Set<PersistListener<S>>();
  const finishHydrationListeners = new Set<PersistListener<S>>();
  let storage = options.storage;

  // 没有storage，就不保存，直接返回config(..args)也就是initState
  if (!storage) {
    return config(
      (...args) => {
        console.warn(
          `[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`
        );
        set(...args);
      },
      get,
      api
    );
  }

  // set partialized item
  const setItem = (): void | Promise<void> => {
    // 只保存partialize处理过的state
    const state = options.partialize({ ...get() });
    return (storage as PersistStorage<S>).setItem(options.name, {
      state,
      version: options.version,
    });
  };

  const savedSetState = api.setState;

  // 替换新的setState，每次更新后都种入storage
  api.setState = (state, replace) => {
    savedSetState(state, replace);
    void setItem();
  };

  const configResult = config(
    /**
     *
    这一步是为了让createState函数里注入的setState和api.setState等价
    因为是这样注入的，更新api.setState不会影响注入的set函数
    const api = { setState, getState, subscribe, destroy }
    state = createState(setState, getState, api)
     */
    (...args) => {
      // 这里的set === savedSetState
      set(...args);
      void setItem();
    },
    get,
    api
  );

  // a workaround to solve the issue of not storing rehydrated state in sync storage
  // the set(state) value would be later overridden with initial state by create()
  // to avoid this, we merge the state from localStorage into the initial state.
  let stateFromStorage: S | undefined;

  // rehydrate initial state with existing stored state
  const hydrate = () => {
    ...
  };

  (api as StoreApi<S> & StorePersist<S, S>).persist = {
    setOptions: (newOptions) => {
      options = {
        ...options,
        ...newOptions,
      };

      if (newOptions.storage) {
        storage = newOptions.storage;
      }
    },
    clearStorage: () => {
      storage?.removeItem(options.name);
    },
    getOptions: () => options,
    rehydrate: () => hydrate() as Promise<void>,
    hasHydrated: () => hasHydrated,
    onHydrate: (cb) => {
      hydrationListeners.add(cb);

      return () => {
        hydrationListeners.delete(cb);
      };
    },
    onFinishHydration: (cb) => {
      finishHydrationListeners.add(cb);

      return () => {
        finishHydrationListeners.delete(cb);
      };
    },
  };

  if (!options.skipHydration) {
    hydrate();
  }

  return stateFromStorage || configResult;
};
```

这里介绍`hydrate`函数部分，主要流程就是从 storage 中读取到初始的状态，通过`toThenable`函数将非`async storage`的值也转换成`promisify`的类型，统一函数的调用形式。先判断获取的值是否需要`migrate`，然后进行`merge`，再进行暴露的与`hydrate`有关的函数的调用。

```ts
const hydrate = () => {
  if (!storage) return;

  // On the first invocation of 'hydrate', state will not yet be defined (this is
  // true for both the 'asynchronous' and 'synchronous' case). Pass 'configResult'
  // as a backup  to 'get()' so listeners and 'onRehydrateStorage' are called with
  // the latest available state.

  hasHydrated = false;
  // 在没有skipHydration的时候，调用hydrate的时候initState还没有生成，get()结果是undefined，所以需要使用前置生成的configResult(还没有和保存的值merge)
  hydrationListeners.forEach((cb) => cb(get() ?? configResult));

  const postRehydrationCallback =
    options.onRehydrateStorage?.(get() ?? configResult) || undefined;

  // bind is used to avoid `TypeError: Illegal invocation` error
  return toThenable(storage.getItem.bind(storage))(options.name)
    .then((deserializedStorageValue) => {
      // 此步为了实现根据version进行旧数据的迁移
      if (deserializedStorageValue) {
        if (
          typeof deserializedStorageValue.version === "number" &&
          deserializedStorageValue.version !== options.version
        ) {
          if (options.migrate) {
            return options.migrate(
              deserializedStorageValue.state,
              deserializedStorageValue.version
            );
          }
          console.error(
            `State loaded from storage couldn't be migrated since no migrate function was provided`
          );
        } else {
          return deserializedStorageValue.state;
        }
      }
    })
    .then((migratedState) => {
      // 这步进行merge
      stateFromStorage = options.merge(
        migratedState as S,
        get() ?? configResult
      );

      set(stateFromStorage as S, true);
      return setItem();
    })
    .then(() => {
      // TODO: In the asynchronous case, it's possible that the state has changed
      // since it was set in the prior callback. As such, it would be better to
      // pass 'get()' to the 'postRehydrationCallback' to ensure the most up-to-date
      // state is used. However, this could be a breaking change, so this isn't being
      // done now.
      postRehydrationCallback?.(stateFromStorage, undefined);

      // It's possible that 'postRehydrationCallback' updated the state. To ensure
      // that isn't overwritten when returning 'stateFromStorage' below
      // (synchronous-case only), update 'stateFromStorage' to point to the latest
      // state. In the asynchronous case, 'stateFromStorage' isn't used after this
      // callback, so there's no harm in updating it to match the latest state.
      stateFromStorage = get();
      hasHydrated = true;
      finishHydrationListeners.forEach((cb) => cb(stateFromStorage as S));
    })
    .catch((e: Error) => {
      postRehydrationCallback?.(undefined, e);
    });
};
```

`toThenable`函数源码

```ts
const toThenable =
  <Result, Input>(
    fn: (input: Input) => Result | Promise<Result> | Thenable<Result>
  ) =>
  (input: Input): Thenable<Result> => {
    try {
      const result = fn(input);
      if (result instanceof Promise) {
        return result as Thenable<Result>;
      }
      return {
        then(onFulfilled) {
          return toThenable(onFulfilled)(result as Result);
        },
        catch(_onRejected) {
          return this as Thenable<any>;
        },
      };
    } catch (e: any) {
      return {
        then(_onFulfilled) {
          return this as Thenable<any>;
        },
        catch(onRejected) {
          return toThenable(onRejected)(e);
        },
      };
    }
  };
```
