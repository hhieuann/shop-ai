"""In tiếng Việt ra console không lỗi trên Windows."""
from __future__ import annotations

import io
import sys


def use_utf8_output() -> None:
    """Đổi stdout, stderr sang UTF-8.

    PowerShell trên Windows thường dùng bảng mã cp1252 hoặc cp1258, in chữ có dấu sẽ báo
    UnicodeEncodeError. Chỉ gọi ở điểm vào của lệnh (cli), không gọi khi import.
    """
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8")
