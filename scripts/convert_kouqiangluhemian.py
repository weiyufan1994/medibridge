#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
口腔颅颌面科数据转换脚本
将临时txt文件转换为Excel和JSON格式
"""

import re
import json
import pandas as pd
from pathlib import Path

# 文件路径
base_dir = Path('/home/ubuntu/medibridge')
input_file = base_dir / 'data/hospitals/上海市第九人民医院_口腔颅颌面科_临时.txt'
output_excel = base_dir / 'data/hospitals/上海市第九人民医院_口腔颅颌面科.xlsx'
output_json = base_dir / 'data/hospitals/上海市第九人民医院_口腔颅颌面科.json'

# 读取临时文件
with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 解析医生信息
def parse_doctors(content):
    doctors = []
    # 按医生分割
    blocks = re.split(r'===医生\d+===', content)
    
    for block in blocks:
        block = block.strip()
        if not block or block.startswith('#'):
            continue
        
        doctor = {}
        lines = block.split('\n')
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
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
                    '个人简介': 'bio',
                    '社会任职': 'social_positions',
                    '获奖荣誉': 'awards',
                    '科研成果': 'research',
                    '病友推荐度': 'recommendation_score',
                    '总患者': 'total_patients'
                }
                if key in field_map:
                    doctor[field_map[key]] = value
        
        if doctor.get('name'):
            doctors.append(doctor)
    
    return doctors

doctors = parse_doctors(content)
print(f"解析到 {len(doctors)} 位医生")

# 转换为DataFrame
df = pd.DataFrame(doctors)

# 确保列顺序
columns = ['name', 'title', 'doctor_id', 'hospital', 'department', 
           'specialty_direction', 'specialty', 'bio', 'social_positions', 
           'awards', 'research', 'recommendation_score', 'total_patients']

# 只保留存在的列
existing_cols = [c for c in columns if c in df.columns]
df = df[existing_cols]

# 列名映射（中文）
col_names_cn = {
    'name': '姓名',
    'title': '职称',
    'doctor_id': 'Doctor_ID',
    'hospital': '医院',
    'department': '科室',
    'specialty_direction': '专业方向',
    'specialty': '专业擅长',
    'bio': '个人简介',
    'social_positions': '社会任职',
    'awards': '获奖荣誉',
    'research': '科研成果',
    'recommendation_score': '病友推荐度',
    'total_patients': '总患者数'
}

df_cn = df.rename(columns=col_names_cn)

# 保存Excel
df_cn.to_excel(output_excel, index=False, engine='openpyxl')
print(f"Excel已保存: {output_excel}")

# 保存JSON
doctors_json = df.to_dict(orient='records')
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(doctors_json, f, ensure_ascii=False, indent=2)
print(f"JSON已保存: {output_json}")

print(f"\n医生列表：")
for i, d in enumerate(doctors, 1):
    print(f"  {i}. {d.get('name', '未知')} - {d.get('title', '未知')}")
