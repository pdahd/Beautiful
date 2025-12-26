# YouTube 视频流信息分析

**视频链接:** `https://m.youtube.com/watch?v=bVQ95AUqMUw`

本文档详细列出了通过 `yt-dlp -F` 命令查询到的所有可用音视频流格式，并对其进行了分类整理。

---

## 音视频合并流 (Audio + Video)

这些流同时包含视频和音频轨道，可以直接下载播放。

| ID  | 格式 | 分辨率    | 帧率 | 声道 | 文件大小 | 比特率 | 协议  | 视频编码      | 音频编码  | 备注     |
|:----|:-----|:----------|:-----|:-----|:---------|:-------|:------|:--------------|:----------|:---------|
| 18  | mp4  | 640x360   | 25   | 2    | 25.87MiB | 334k   | https | avc1.42001E   | mp4a.40.2 | 360p     |
| 91  | mp4  | 256x144   | 25   | -    | ~13.44MiB| 174k   | m3u8  | avc1.4D400C   | mp4a.40.5 | Untested |
| 92  | mp4  | 426x240   | 25   | -    | ~24.36MiB| 314k   | m3u8  | avc1.4D4015   | mp4a.40.5 | Untested |
| 93  | mp4  | 640x360   | 25   | -    | ~47.07MiB| 607k   | m3u8  | avc1.4D401E   | mp4a.40.2 | Untested |
| 94  | mp4  | 854x480   | 25   | -    | ~64.02MiB| 826k   | m3u8  | avc1.4D401E   | mp4a.40.2 | Untested |
| 300 | mp4  | 1280x720  | 50   | -    | ~220.88MiB| 2851k  | m3u8  | avc1.4D4020   | mp4a.40.2 | Untested |
| 301 | mp4  | 1920x1080 | 50   | -    | ~358.23MiB| 4623k  | m3u8  | avc1.64002A   | mp4a.40.2 | Untested |

---

## 仅视频流 (Video-Only)

这些是 DASH (Dynamic Adaptive Streaming over HTTP) 格式的视频流，不包含音频。需要与下方的音频流合并才能获得完整的视频。

| ID  | 格式 | 分辨率    | 帧率 | 文件大小 | 比特率 | 协议  | 视频编码      | 备注        |
|:----|:-----|:----------|:-----|:---------|:-------|:------|:--------------|:------------|
| 160 | mp4  | 256x144   | 25   | 2.11MiB  | 27k    | https | avc1.4d400c   | 144p        |
| 278 | webm | 256x144   | 25   | 4.06MiB  | 52k    | https | vp9           | 144p        |
| 394 | mp4  | 256x144   | 25   | 2.50MiB  | 32k    | https | av01.0.00M.08 | 144p        |
| 133 | mp4  | 426x240   | 25   | 4.14MiB  | 53k    | https | avc1.4d4015   | 240p        |
| 242 | webm | 426x240   | 25   | 6.25MiB  | 81k    | https | vp9           | 240p        |
| 395 | mp4  | 426x240   | 25   | 4.36MiB  | 56k    | https | av01.0.00M.08 | 240p        |
| 134 | mp4  | 640x360   | 25   | 7.96MiB  | 103k   | https | avc1.4d401e   | 360p        |
| 243 | webm | 640x360   | 25   | 12.68MiB | 164k   | https | vp9           | 360p        |
| 396 | mp4  | 640x360   | 25   | 7.99MiB  | 103k   | https | av01.0.01M.08 | 360p        |
| 135 | mp4  | 854x480   | 25   | 13.56MiB | 175k   | https | avc1.4d401e   | 480p        |
| 244 | webm | 854x480   | 25   | 17.93MiB | 231k   | https | vp9           | 480p        |
| 397 | mp4  | 854x480   | 25   | 12.31MiB | 159k   | https | av01.0.04M.08 | 480p        |
| 298 | mp4  | 1280x720  | 50   | 50.84MiB | 656k   | https | avc1.4d4020   | 720p50      |
| 302 | webm | 1280x720  | 50   | 43.25MiB | 558k   | https | vp9           | 720p50      |
| 398 | mp4  | 1280x720  | 50   | 25.93MiB | 335k   | https | av01.0.08M.08 | 720p50      |
| 299 | mp4  | 1920x1080 | 50   | 84.10MiB | 1085k  | https | avc1.64002a   | 1080p50     |
| 303 | webm | 1920x1080 | 50   | 113.85MiB| 1469k  | https | vp9           | 1080p50     |
| 399 | mp4  | 1920x1080 | 50   | 45.77MiB | 591k   | https | av01.0.09M.08 | 1080p50     |
| 308 | webm | 2560x1440 | 50   | 172.48MiB| 2226k  | https | vp9           | 1440p50     |
| 400 | mp4  | 2560x1440 | 50   | 93.05MiB | 1201k  | https | av01.0.12M.08 | 1440p50     |
| 315 | webm | 3840x2160 | 50   | 616.93MiB| 7961k  | https | vp9           | 2160p50     |
| 401 | mp4  | 3840x2160 | 50   | 172.65MiB| 2228k  | https | av01.0.13M.08 | 2160p50     |

---

## 仅音频流 (Audio-Only)

这些是 DASH 格式的纯音频流。

| ID      | 格式 | 声道 | 文件大小 | 比特率 | 协议  | 音频编码  | 采样率 | 备注             |
|:--------|:-----|:-----|:---------|:-------|:------|:----------|:-------|:-----------------|
| 139-drc | m4a  | 2    | 3.78MiB  | 49k    | https | mp4a.40.5 | 22k    | low, DRC         |
| 249-drc | webm | 2    | 3.98MiB  | 51k    | https | opus      | 48k    | low, DRC         |
| 139     | m4a  | 2    | 3.78MiB  | 49k    | https | mp4a.40.5 | 22k    | low              |
| 249     | webm | 2    | 3.98MiB  | 51k    | https | opus      | 48k    | low              |
| 140-drc | m4a  | 2    | 10.04MiB | 129k   | https | mp4a.40.2 | 44k    | medium, DRC      |
| 251-drc | webm | 2    | 8.92MiB  | 115k   | https | opus      | 48k    | medium, DRC      |
| 140     | m4a  | 2    | 10.04MiB | 129k   | https | mp4a.40.2 | 44k    | medium           |
| 251     | webm | 2    | 8.92MiB  | 115k   | https | opus      | 48k    | medium           |

---

## 其他格式 (Other Formats)

主要包含用于预览的图像流（故事板）。

| ID  | 格式  | 分辨率 | 协议  | 编码   | 备注       |
|:----|:------|:-------|:------|:-------|:-----------|
| sb2 | mhtml | 48x27  | mhtml | images | storyboard |
| sb1 | mhtml | 80x45  | mhtml | images | storyboard |
| sb0 | mhtml | 160x90 | mhtml | images | storyboard |
