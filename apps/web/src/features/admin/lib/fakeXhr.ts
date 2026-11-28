/**
 * XMLHttpRequest giả cho test tải ảnh lên S3 (jsdom không gửi request thật). Mỗi `send` thêm vào
 * `FakeXhr.instances`; test tự gọi `progress`, `respond`, `fail` để mô phỏng S3.
 * Chỉ dùng trong test.
 */
export class FakeXhr {
  static instances: FakeXhr[] = [];

  method = '';
  url = '';
  body: FormData | null = null;
  status = 0;
  aborted = false;
  readonly upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.body = body;
    FakeXhr.instances.push(this);
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }

  respond(status: number) {
    this.status = status;
    this.onload?.();
  }

  fail() {
    this.onerror?.();
  }

  /** Tên các trường FormData theo thứ tự gửi */
  fieldNames(): string[] {
    return this.body ? [...this.body.keys()] : [];
  }

  static last(): FakeXhr | undefined {
    return FakeXhr.instances[FakeXhr.instances.length - 1];
  }

  static reset() {
    FakeXhr.instances = [];
  }
}
