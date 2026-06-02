import React, { useState } from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

// jsdom does no layout, so offsetParent is always null — which would make the
// hook's visibility filter treat every element as hidden. Stub it to report a
// parent (as a real browser does for visible elements) for the duration of the
// suite so the keyboard-cycling assertions exercise the real code path.
let offsetParentSpy;
beforeAll(() => {
  offsetParentSpy = jest
    .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
    .mockImplementation(function get() {
      return this.parentNode;
    });
});
afterAll(() => offsetParentSpy.mockRestore());

/** A trigger button + a dialog (3 buttons) gated by the hook. */
function Harness({ onEscape, renderEmpty = false }) {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap(open, { onEscape: onEscape || (() => setOpen(false)) });
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <div ref={ref} role="dialog" aria-label="test">
          {!renderEmpty && (
            <>
              <button>first</button>
              <button>middle</button>
              <button>last</button>
            </>
          )}
          {renderEmpty && <p>read-only content</p>}
        </div>
      )}
    </div>
  );
}

const tab = (shiftKey = false) =>
  fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey });

describe('useFocusTrap', () => {
  test('moves focus to the first focusable control on activate', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByText('first')).toHaveFocus();
  });

  test('Tab from the last control wraps to the first', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    act(() => screen.getByText('last').focus());
    tab();
    expect(screen.getByText('first')).toHaveFocus();
  });

  test('Shift+Tab from the first control wraps to the last', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByText('first')).toHaveFocus();
    tab(true);
    expect(screen.getByText('last')).toHaveFocus();
  });

  test('Escape invokes onEscape', () => {
    const onEscape = jest.fn();
    render(<Harness onEscape={onEscape} />);
    fireEvent.click(screen.getByText('open'));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  test('restores focus to the trigger when the dialog closes', () => {
    render(<Harness />);
    const trigger = screen.getByText('open');
    // A real user tabs to / activates the trigger, so it holds focus when the
    // dialog opens. (jsdom's fireEvent.click doesn't focus it the way Chrome
    // does, so set it up explicitly.)
    act(() => trigger.focus());
    fireEvent.click(trigger); // default onEscape closes via setOpen(false)
    expect(screen.getByText('first')).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });

  test('with no focusable children, focus lands on the container itself', () => {
    render(<Harness renderEmpty />);
    fireEvent.click(screen.getByText('open'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });
});
