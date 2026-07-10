# -*- coding: utf-8 -*-
# モードB グリッド検出の検証用テスト画像生成（グラウンドトゥルース付き）
# 実運用テンプレに近い 1080x1350 (4:5) の空シフト表テンプレを8パターン生成する。
import json, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "gridtest")
os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1350
GX0, GX1 = 60, 1020          # グリッド左右
GY0, GY1 = 300, 1290         # グリッド上下
HEADER_H = 90                # ヘッダー行高
DATA_ROWS = 5                # データ行数
DATA_H = (GY1 - GY0 - HEADER_H) // DATA_ROWS  # 180

def h_lines_std():
    ys = [GY0, GY0 + HEADER_H]
    for i in range(1, DATA_ROWS + 1):
        ys.append(GY0 + HEADER_H + i * DATA_H)
    return ys  # 7本

def v_lines_equal(cols=7):
    step = (GX1 - GX0) / cols
    return [round(GX0 + i * step) for i in range(cols + 1)]

try:
    FONT_L = ImageFont.truetype(r"C:\Windows\Fonts\msgothic.ttc", 64)
    FONT_M = ImageFont.truetype(r"C:\Windows\Fonts\msgothic.ttc", 36)
except Exception:
    FONT_L = ImageFont.load_default()
    FONT_M = ImageFont.load_default()

WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"]

def draw_grid(d, vls, hls, color, width=3):
    for x in vls:
        d.line([(x, hls[0]), (x, hls[-1])], fill=color, width=width)
    for y in hls:
        d.line([(vls[0], y), (vls[-1], y)], fill=color, width=width)

def draw_header_text(d, vls, y0, color):
    for i in range(len(vls) - 1):
        cx = (vls[i] + vls[i + 1]) // 2
        d.text((cx, y0 + HEADER_H // 2), WEEKDAYS[i % 7], font=FONT_M, fill=color, anchor="mm")

gt = []

def record(name, vls, hls, expect_null=False, note=""):
    gt.append({
        "file": name, "w": W, "h": H,
        "vLines": vls, "hLines": hls,
        "cols": (len(vls) - 1) if vls else None,
        "rawRows": (len(hls) - 1) if hls else None,
        "expectNull": expect_null, "note": note,
    })

# T1: 白地×黒罫線の標準（タイトル文字＋曜日ヘッダ文字あり）
img = Image.new("RGB", (W, H), "#FFFFFF")
d = ImageDraw.Draw(img)
d.text((W // 2, 150), "出勤スケジュール", font=FONT_L, fill="#222222", anchor="mm")
vls, hls = v_lines_equal(), h_lines_std()
draw_grid(d, vls, hls, "#222222")
draw_header_text(d, vls, GY0, "#222222")
img.save(os.path.join(OUT, "T1_plain.png"))
record("T1_plain.png", vls, hls, note="標準・黒罫線")

# T2: パステル（薄ピンク罫線＝輝度212で固定閾値128では検出不能なはず）
img = Image.new("RGB", (W, H), "#FDF6F7")
d = ImageDraw.Draw(img)
d.text((W // 2, 150), "しふとひょう", font=FONT_L, fill="#C77A93", anchor="mm")
draw_grid(d, vls, hls, "#E8C9D4")
draw_header_text(d, vls, GY0, "#C77A93")
img.save(os.path.join(OUT, "T2_pastel.png"))
record("T2_pastel.png", vls, hls, note="薄色罫線（輝度~212）")

# T3: ダーク背景×明色罫線（20テンプレ中6種がダーク系）
img = Image.new("RGB", (W, H), "#14101A")
d = ImageDraw.Draw(img)
d.text((W // 2, 150), "SCHEDULE", font=FONT_L, fill="#C9B8E8", anchor="mm")
draw_grid(d, vls, hls, "#C9B8E8")
draw_header_text(d, vls, GY0, "#C9B8E8")
img.save(os.path.join(OUT, "T3_dark.png"))
record("T3_dark.png", vls, hls, note="ダーク背景・極性反転が必要")

# T4: 不等幅列（時間列100px＋等幅6列）
vls4 = [GX0, GX0 + 100]
step = (GX1 - GX0 - 100) / 6
for i in range(1, 7):
    vls4.append(round(GX0 + 100 + i * step))
img = Image.new("RGB", (W, H), "#FFFFFF")
d = ImageDraw.Draw(img)
d.text((W // 2, 150), "週間シフト", font=FONT_L, fill="#222222", anchor="mm")
draw_grid(d, vls4, hls, "#222222")
img.save(os.path.join(OUT, "T4_uneven.png"))
record("T4_uneven.png", vls4, hls, note="不等幅列・本数/範囲は正しく出るべき")

# T5: ソリッド帯（タイトルリボン130px）＋グリッド → 帯を罫線と誤認しないか
img = Image.new("RGB", (W, H), "#FFFFFF")
d = ImageDraw.Draw(img)
d.rectangle([40, 60, 1040, 190], fill="#D2426E")
d.text((W // 2, 125), "SHIFT", font=FONT_L, fill="#FFFFFF", anchor="mm")
draw_grid(d, vls, hls, "#333333")
draw_header_text(d, vls, GY0, "#333333")
img.save(os.path.join(OUT, "T5_banner.png"))
record("T5_banner.png", vls, hls, note="ソリッド帯は罫線として数えない")

# T6: グリッド無し（グラデ＋ブロブ）→ null が正解
img = Image.new("RGB", (W, H), "#FFFFFF")
d = ImageDraw.Draw(img)
for y in range(H):
    c = int(200 + 40 * y / H)
    d.line([(0, y), (W, y)], fill=(c, int(c * 0.9), int(c * 0.95)))
d.ellipse([200, 300, 700, 800], fill="#E9A7C0")
d.ellipse([500, 700, 950, 1200], fill="#B7D3E8")
d.text((W // 2, 150), "Cafe Lumiere", font=FONT_L, fill="#7A5A6A", anchor="mm")
img = img.filter(ImageFilter.GaussianBlur(2))
img.save(os.path.join(OUT, "T6_nogrid.png"))
record("T6_nogrid.png", None, None, expect_null=True, note="グリッド無し→null")

# T7: 角丸セルボックス式（セル間ギャップ10px＝境界ごとに二重線）
img = Image.new("RGB", (W, H), "#FFF8FA")
d = ImageDraw.Draw(img)
d.text((W // 2, 150), "Weekly Shift", font=FONT_L, fill="#D2426E", anchor="mm")
GAP = 10
band_ys = h_lines_std()
for r in range(len(band_ys) - 1):
    for c in range(7):
        x0 = vls[c] + GAP // 2
        x1 = vls[c + 1] - GAP // 2
        y0 = band_ys[r] + GAP // 2
        y1 = band_ys[r + 1] - GAP // 2
        d.rounded_rectangle([x0, y0, x1, y1], radius=10, outline="#D2426E", width=3)
img.save(os.path.join(OUT, "T7_cellbox.png"))
record("T7_cellbox.png", vls, hls, note="二重線→マージして7列6行帯に")

# T8: T2をJPEG q70で（ノイズ耐性）
Image.open(os.path.join(OUT, "T2_pastel.png")).convert("RGB").save(
    os.path.join(OUT, "T8_jpeg.jpg"), quality=70)
record("T8_jpeg.jpg", vls, hls, note="パステル＋JPEGノイズ")

with open(os.path.join(OUT, "ground_truth.json"), "w", encoding="utf-8") as f:
    json.dump(gt, f, ensure_ascii=False, indent=1)
print("generated:", len(gt), "images ->", OUT)
