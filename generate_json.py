import os
import json

# 你的图片文件夹名
image_dir = 'images'

# 如果文件夹不存在，提示一下
if not os.path.exists(image_dir):
    print(f"找不到 '{image_dir}' 文件夹！请确认已经创建并放入了图片。")
else:
    # 获取所有图片文件名，并排序
    files = sorted([f for f in os.listdir(image_dir) if f.lower().endswith('.webp')])
    
    # 保存为 JSON 文件
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(files, f, ensure_ascii=False, indent=4)
        
    print(f"成功！已读取 {len(files)} 张图片，并生成 'data.json' 文件。")