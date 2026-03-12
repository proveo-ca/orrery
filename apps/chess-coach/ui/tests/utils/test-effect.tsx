import { createEffect } from 'solid-js';
import { render } from '@solidjs/testing-library';

interface TestHookProps<T> {
  hook: (props: T) => any;
  props: T;
  onResult?: (result: any) => void;
}

export const TestHook = <T,>(props: TestHookProps<T>) => {
  // Call the hook with the provided props
  const result = props.hook(props.props);

  // createEffect tracks reactive changes automatically
  createEffect(() => {
    props.onResult?.(result);
  });

  return null;
};

export const renderHookTest = <T,>(props: TestHookProps<T>) =>
  render(() => <TestHook {...props} />);