(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.state = {
    createHistory,
    createAutoSave
  };

  function createHistory(options = {}) {
    const limit = Math.max(1, Number(options.limit || 50));
    const clone = options.clone || cloneData;
    const past = [];
    const future = [];

    return {
      record,
      undo,
      redo,
      clear,
      get canUndo() {
        return past.length > 0;
      },
      get canRedo() {
        return future.length > 0;
      },
      get size() {
        return past.length;
      }
    };

    function record(snapshot) {
      if (snapshot == null) {
        return;
      }

      const next = clone(snapshot);
      const previous = past[past.length - 1];
      if (previous && sameValue(previous, next)) {
        return;
      }

      past.push(next);
      if (past.length > limit) {
        past.shift();
      }
      future.length = 0;
    }

    function undo(current) {
      if (!past.length) {
        return null;
      }

      future.push(clone(current));
      return clone(past.pop());
    }

    function redo(current) {
      if (!future.length) {
        return null;
      }

      past.push(clone(current));
      return clone(future.pop());
    }

    function clear() {
      past.length = 0;
      future.length = 0;
    }
  }

  function createAutoSave(options = {}) {
    const storage = options.storage;
    const key = String(options.key || "");
    const delay = Math.max(0, Number(options.delay ?? 700));
    let timer = 0;
    let pending = null;

    return {
      schedule,
      flush,
      load,
      clear,
      cancel
    };

    function schedule(value) {
      pending = value;
      clearTimeout(timer);
      options.onPending?.();
      timer = setTimeout(flush, delay);
    }

    function flush() {
      clearTimeout(timer);
      timer = 0;

      if (pending == null || !storage || !key) {
        return false;
      }

      try {
        storage.setItem(key, JSON.stringify(pending));
        pending = null;
        options.onSave?.();
        return true;
      } catch (error) {
        options.onError?.(error);
        return false;
      }
    }

    function load() {
      if (!storage || !key) {
        return null;
      }

      try {
        const value = storage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        options.onError?.(error);
        return null;
      }
    }

    function clear() {
      cancel();
      try {
        storage?.removeItem(key);
      } catch (error) {
        options.onError?.(error);
      }
    }

    function cancel() {
      clearTimeout(timer);
      timer = 0;
      pending = null;
    }
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
})(globalThis);
