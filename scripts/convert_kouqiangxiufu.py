#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
口腔修复科数据转换脚本
将临时txt文件转换为Excel和JSON格式
"""

import re
import json
import pandas as pd
from pathlib import Path

# 文件路径
base_dir = Path('/home/ubuntu/medibridge')
input_file = base_dir / 'data/hospitals/上海市第九人民医院_口腔修复科_临时.txt'
output_excel = base_dir / 'data/hospitals/上海市第九人民医院_口腔修复科.xlsx'
output_json = base_dir / 'data/hospitals/上海市第九人民医院_口腔修复科.json'

def parse_doctors(text):
    doctors = []
    # 按医生分隔
    blocks = re.split(r'===医生\d+===', text)
    for block in blocks:
        block = block.strip()
        if not block or block.startswith('#'):
            continue
        
        doctor = {}
        lines = block.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
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
                    '总患者': 'total_patients',
                }
                if key in field_map:
                    doctor[field_map[key]] = value
        
        if doctor.get('name'):
            # 补充缺失字段
            for field in ['name', 'title', 'doctor_id', 'hospital', 'department', 
                         'specialty_direction', 'specialty', 'bio', 'social_positions', 
                         'awards', 'research', 'recommendation_score', 'total_patients']:
                if field not in doctor:
                    doctor[field] = '暂无'
            # 添加来源URL
            doctor['profile_url'] = f"https://www.haodf.com/doctor/{doctor['doctor_id']}/xinxi-jieshao.html"
            doctors.append(doctor)
    
    return doctors

# 读取文件
with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

doctors = parse_doctors(content)
print(f'解析到 {len(doctors)} 位医生')

# 转换为DataFrame
df = pd.DataFrame(doctors)

# 列名中文映射
column_names = {
    'name': '姓名',
    'title': '职称',
    'doctor_id': 'Doctor ID',
    'hospital': '医院',
    'department': '科室',
    'specialty_direction': '专业方向',
    'specialty': '专业擅长',
    'bio': '个人简介',
    'social_positions': '社会任职',
    'awards': '获奖荣誉',
    'research': '科研成果',
    'recommendation_score': '病友推荐度',
    'total_patients': '总患者数',
    'profile_url': '主页链接',
}
df_display = df.rename(columns=column_names)

# 保存Excel
df_display.to_excel(output_excel, index=False, engine='openpyxl')
print(f'Excel已保存: {output_excel}')

# 保存JSON
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(doctors, f, ensure_ascii=False, indent=2)
print(f'JSON已保存: {output_json}')

print(f'\n医生列表:')
for i, d in enumerate(doctors, 1):
    print(f'{i:2d}. {d["name"]} - {d["title"]}')
