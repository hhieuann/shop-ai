// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil, Trash2 } from 'lucide-react';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';

afterEach(cleanup);

const LABEL = 'Thao tác khác: Card RTX 4060';

function setup() {
  const items = {
    edit: vi.fn(),
    copy: vi.fn(),
    hide: vi.fn(),
    remove: vi.fn(),
  };
  const list: ActionMenuItem[] = [
    { label: 'Sửa', icon: Pencil, onSelect: items.edit },
    { label: 'Nhân bản', onSelect: items.copy },
    { label: 'Ẩn khỏi cửa hàng', onSelect: items.hide },
    { label: 'Xoá', icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: items.remove },
  ];
  render(
    <>
      <ActionMenu label={LABEL} items={list} />
      <button type="button">Bên ngoài</button>
    </>,
  );
  return { items, trigger: screen.getByRole('button', { name: LABEL }) };
}

describe('ActionMenu', () => {
  it('trigger_isMenuButton_closedByDefault', () => {
    // Act
    const { trigger } = setup();

    // Assert
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('click_opensMenu_focusesFirstItem_withSeparatorBeforeDanger', async () => {
    // Arrange
    const { trigger } = setup();

    // Act
    await userEvent.click(trigger);

    // Assert
    const menu = screen.getByRole('menu', { name: LABEL });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Sửa',
      'Nhân bản',
      'Ẩn khỏi cửa hàng',
      'Xoá',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Sửa' })).toHaveFocus();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('arrowKeys_moveFocusAndWrap_homeEndJump', async () => {
    // Arrange
    const { trigger } = setup();
    await userEvent.click(trigger);

    // Act + Assert
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Nhân bản' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Xoá' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Sửa' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Xoá' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Sửa' })).toHaveFocus();
  });

  it('arrowUpOnTrigger_opensWithLastItemFocused', async () => {
    // Arrange
    const { trigger } = setup();
    trigger.focus();

    // Act
    await userEvent.keyboard('{ArrowUp}');

    // Assert
    expect(screen.getByRole('menuitem', { name: 'Xoá' })).toHaveFocus();
  });

  it('escape_closesMenu_andReturnsFocusToTrigger', async () => {
    // Arrange
    const { trigger, items } = setup();
    await userEvent.click(trigger);

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
    // Verify
    expect(items.edit).not.toHaveBeenCalled();
  });

  it('selectItem_closesMenu_returnsFocus_thenCallsItOnce', async () => {
    // Arrange
    const { trigger, items } = setup();
    await userEvent.click(trigger);

    // Act
    await userEvent.click(screen.getByRole('menuitem', { name: 'Xoá' }));

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
    // Verify
    expect(items.remove).toHaveBeenCalledTimes(1);
    expect(items.edit).not.toHaveBeenCalled();
  });

  it('enterOnFocusedItem_selectsIt', async () => {
    // Arrange
    const { trigger, items } = setup();
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');

    // Act
    await userEvent.keyboard('{ArrowDown}{Enter}');

    // Assert
    expect(items.copy).toHaveBeenCalledTimes(1);
  });

  it('clickOutside_closesWithoutMovingFocusBack', async () => {
    // Arrange
    const { trigger } = setup();
    await userEvent.click(trigger);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Bên ngoài' }));

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bên ngoài' })).toHaveFocus();
  });

  it('tab_closesMenu', async () => {
    // Arrange
    const { trigger } = setup();
    await userEvent.click(trigger);

    // Act
    await userEvent.tab();

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('clickTriggerAgain_closesMenu', async () => {
    // Arrange
    const { trigger } = setup();
    await userEvent.click(trigger);

    // Act
    await userEvent.click(trigger);

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
