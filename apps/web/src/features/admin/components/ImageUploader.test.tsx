// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FakeXhr } from '../lib/fakeXhr';
import { ImageUploader } from './ImageUploader';

const IMAGE_URL =
  'https://d111111abcdef8.cloudfront.net/images/products/01KAB3Q5G00000000000000001.jpg';
const TICKET = {
  upload: {
    url: 'https://bucket.s3.ap-southeast-1.amazonaws.com/',
    fields: { key: 'products/01KAB3Q5G00000000000000001.jpg', 'Content-Type': 'image/jpeg' },
  },
  imageUrl: IMAGE_URL,
  expiresAt: '2026-11-26T05:05:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status < 400 ? 'application/json' : 'application/problem+json' },
  });
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const jpg = (size = 2048) => new File([new Uint8Array(size)], 'card.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  FakeXhr.reset();
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  fetchMock.mockReset().mockImplementation(async () => json(TICKET));
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Giữ giá trị như form thật để thấy ảnh sau khi tải */
function Harness({
  initial = '',
  onUploading = vi.fn(),
}: {
  initial?: string;
  onUploading?: (b: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ImageUploader value={value} onChange={setValue} onUploadingChange={onUploading} />
      <p data-testid="value">{value}</p>
    </>
  );
}

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const value = () => screen.getByTestId('value').textContent;

async function chooseFile(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(fileInput(), file);
  return user;
}

describe('ImageUploader (catalog.md BR-16)', () => {
  it('defaultsToUploadMode_withRealButton', () => {
    // Act
    render(<Harness />);

    // Assert
    expect(screen.getByRole('radio', { name: 'Tải ảnh lên' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tải ảnh từ máy' })).toBeInTheDocument();
    expect(screen.getByText('JPG, PNG hoặc WebP, tối đa 3 MB')).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('upload_requestsTicket_showsProgress_thenFillsImageUrl', async () => {
    // Arrange
    const onUploading = vi.fn();
    render(<Harness onUploading={onUploading} />);

    // Act
    await chooseFile(jpg(2048));

    // Assert: xin vé với loại và cỡ tệp, không gửi tên tệp
    await waitFor(() => expect(FakeXhr.last()).toBeDefined());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/admin/product-images');
    expect(JSON.parse(String(init?.body))).toEqual({ contentType: 'image/jpeg', size: 2048 });
    expect(onUploading).toHaveBeenLastCalledWith(true);

    // Act: S3 báo tiến độ
    act(() => FakeXhr.last()!.progress(512, 2048));

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải ảnh… 25%');
    expect(screen.getByRole('progressbar', { name: 'Tiến độ tải ảnh' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );

    // Act: S3 nhận tệp
    await act(async () => FakeXhr.last()!.respond(204));

    // Assert
    await waitFor(() => expect(value()).toBe(IMAGE_URL));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đổi ảnh' })).toBeInTheDocument();
    expect(onUploading).toHaveBeenLastCalledWith(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it.each([
    [
      'SVG',
      new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }),
      'Chỉ nhận ảnh JPG, PNG hoặc WebP.',
    ],
    ['4 MB', jpg(4 * 1024 * 1024), 'Ảnh tối đa 3 MB. Chọn ảnh nhỏ hơn.'],
  ])('rejects_%s_beforeRequestingTicket', async (_name, file, message) => {
    // Arrange
    render(<Harness />);

    // Act
    await chooseFile(file);

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('removeWhileUploading_abortsAndLeavesEmpty', async () => {
    // Arrange
    const onUploading = vi.fn();
    const user = userEvent.setup();
    render(<Harness onUploading={onUploading} />);
    await chooseFile(jpg());
    await waitFor(() => expect(FakeXhr.last()).toBeDefined());

    // Act
    await user.click(screen.getByRole('button', { name: 'Bỏ ảnh này' }));

    // Assert: lượt tải dừng, khung về trống, không báo lỗi
    expect(FakeXhr.last()!.aborted).toBe(true);
    expect(value()).toBe('');
    expect(screen.getByRole('button', { name: 'Tải ảnh từ máy' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onUploading).toHaveBeenLastCalledWith(false);
  });

  it('removeWhileWaitingForTicket_ignoresTicketAndNeverUploads', async () => {
    // Arrange: API vé chưa trả lời
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const user = userEvent.setup();
    render(<Harness />);
    await chooseFile(jpg());

    // Act
    await user.click(screen.getByRole('button', { name: 'Bỏ ảnh này' }));
    await act(async () => answer(json(TICKET)));

    // Assert
    expect(FakeXhr.instances).toHaveLength(0);
    expect(value()).toBe('');
  });

  it('removeAfterUpload_clearsImage', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness initial={IMAGE_URL} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Bỏ ảnh này' }));

    // Assert
    expect(value()).toBe('');
    expect(screen.getByRole('button', { name: 'Tải ảnh từ máy' })).toBeInTheDocument();
  });

  it.each([
    ['S3 từ chối', (x: FakeXhr) => x.respond(403)],
    ['lỗi mạng', (x: FakeXhr) => x.fail()],
  ])('showsRetryMessage_when_%s', async (_name, finish) => {
    // Arrange
    render(<Harness />);
    await chooseFile(jpg());
    await waitFor(() => expect(FakeXhr.last()).toBeDefined());

    // Act
    await act(async () => finish(FakeXhr.last()!));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được ảnh. Thử lại.');
    expect(value()).toBe('');
  });

  it('showsRetryMessage_whenTicketApiFails', async () => {
    // Arrange
    fetchMock.mockImplementation(async () => json({ title: 'Lỗi' }, 500));
    render(<Harness />);

    // Act
    await chooseFile(jpg());

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được ảnh. Thử lại.');
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('dropFile_startsUpload_andHighlightsWhileDragging', async () => {
    // Arrange
    render(<Harness />);
    const zone = screen.getByText('Kéo ảnh vào đây hoặc').closest('div')!.parentElement!;

    // Act
    fireEvent.dragOver(zone, { dataTransfer: { files: [] } });
    const highlighted = zone.className;
    fireEvent.drop(zone, { dataTransfer: { files: [jpg()] } });

    // Assert
    expect(highlighted).toMatch(/dragging/);
    await waitFor(() => expect(FakeXhr.instances).toHaveLength(1));
    expect(zone.className).not.toMatch(/dragging/);
  });

  it('keyboard_arrowKeysSwitchMode_andButtonOpensFilePicker', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    // user-event tự xử lý click của ô chọn tệp; theo dõi ở prototype để thấy lệnh mở hộp chọn tệp
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    // Act: Tab tới nút phân đoạn đang chọn, mũi tên phải sang "Dán đường dẫn"
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Tải ảnh lên' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');

    // Assert
    expect(screen.getByRole('radio', { name: 'Dán đường dẫn' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: /Đường dẫn ảnh/ })).toBeInTheDocument();

    // Act: về "Tải ảnh lên", Tab tới nút thật, Enter mở hộp chọn tệp
    await user.keyboard('{ArrowLeft}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Tải ảnh từ máy' })).toHaveFocus();
    await user.keyboard('{Enter}');

    // Assert
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('opensLinkMode_whenImageIsExternalHttps', () => {
    // Act
    render(<Harness initial="https://example.com/card.webp" />);

    // Assert
    expect(screen.getByRole('radio', { name: 'Dán đường dẫn' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('textbox', { name: /Đường dẫn ảnh/ })).toHaveValue(
      'https://example.com/card.webp',
    );
  });

  it('opensUploadMode_whenImageIsInShopBucket', () => {
    // Act
    render(<Harness initial={IMAGE_URL} />);

    // Assert
    expect(screen.getByRole('radio', { name: 'Tải ảnh lên' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Bỏ ảnh này' })).toBeInTheDocument();
  });

  it('switchingModeWhileUploading_abortsUpload', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    await chooseFile(jpg());
    await waitFor(() => expect(FakeXhr.last()).toBeDefined());

    // Act
    await user.click(screen.getByRole('radio', { name: 'Dán đường dẫn' }));

    // Assert
    expect(FakeXhr.last()!.aborted).toBe(true);
  });

  it('unmountWhileUploading_aborts', async () => {
    // Arrange
    const { unmount } = render(<Harness />);
    await chooseFile(jpg());
    await waitFor(() => expect(FakeXhr.last()).toBeDefined());

    // Act
    unmount();

    // Assert
    expect(FakeXhr.last()!.aborted).toBe(true);
  });
});
