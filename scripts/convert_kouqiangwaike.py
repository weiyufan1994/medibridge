#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
口腔外科数据转换脚本
将临时txt文件转换为Excel和JSON格式
"""

import json
import re
import os
import pandas as pd
from datetime import datetime

# 读取临时文件
input_file = "/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_口腔外科_临时.txt"
output_excel = "/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_口腔外科.xlsx"
output_json = "/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_口腔外科.json"

with open(input_file, "r", encoding="utf-8") as f:
    content = f.read()

# 按医生分割
doctor_blocks = re.split(r'===医生\d+===\n', content)
doctor_blocks = [b.strip() for b in doctor_blocks if b.strip()]

doctors = []
for block in doctor_blocks:
    doc = {}
    lines = block.split('\n')
    for line in lines:
        if '：' in line:
            key, _, value = line.partition('：')
            key = key.strip()
            value = value.strip()
            field_map = {
                '姓名': 'name',
                '职称': 'title',
                'doctor_id': 'doctor_id',
                '医院': 'hospital',
                '科室': 'department',
                '专业方向': 'specialty_direction',
                '专业擅长': 'specialty',
                '个人简介': 'introduction',
                '社会任职': 'social_positions',
                '科研成果': 'research',
                '病友推荐度': 'recommendation_rate',
                '总患者': 'total_patients',
            }
            if key in field_map:
                doc[field_map[key]] = value
    if doc.get('name'):
        # 添加URL字段
        doc_id = doc.get('doctor_id', '')
        doc['url'] = f"https://www.haodf.com/doctor/{doc_id}/xinxi-jieshao.html" if doc_id else ''
        doc['scrape_date'] = datetime.now().strftime('%Y-%m-%d')
        doctors.append(doc)

print(f"共解析 {len(doctors)} 位医生")

# 保存JSON
with open(output_json, "w", encoding="utf-8") as f:
    json.dump(doctors, f, ensure_ascii=False, indent=2)
print(f"JSON已保存: {output_json}")

# 保存Excel
columns_order = ['name', 'title', 'doctor_id', 'hospital', 'department', 
                 'specialty_direction', 'specialty', 'introduction', 
                 'social_positions', 'research', 'recommendation_rate', 
                 'total_patients', 'url', 'scrape_date']
columns_cn = ['姓名', '职称', 'Doctor_ID', '医院', '科室', 
              '专业方向', '专业擅长', '个人简介', 
              '社会任职', '科研成果', '病友推荐度', 
              '总患者', 'URL', '抓取日期']

df = pd.DataFrame(doctors)
for col in columns_order:
    if col not in df.columns:
        df[col] = ''
df = df[columns_order]
df.columns = columns_cn

df.to_excel(output_excel, index=False, engine='openpyxl')
print(f"Excel已保存: {output_excel}")
print(f"完成！共 {len(doctors)} 位医生")
