#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解析上海市第九人民医院眼科临时文件，生成Excel
"""

import re
import pandas as pd
from pathlib import Path

INPUT_FILE = "/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_眼科_临时.txt"
OUTPUT_FILE = "/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_眼科_医生详细信息.xlsx"

def parse_temp_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 按 ---医生N--- 分割
    blocks = re.split(r'---医生\d+[^-]*---', content)
    
    doctors = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        # 跳过标注为跳过的条目
        if block.startswith('[跳过]'):
            print(f"跳过: {block[:60]}")
            continue
        # 跳过注释行（以#开头）
        if block.startswith('#'):
            continue
        
        def extract_field(text, field_name):
            pattern = rf'^{re.escape(field_name)}:\s*(.+?)(?=\n\w|$)'
            match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
            if match:
                val = match.group(1).strip()
                # 清理多行内容
                val = re.sub(r'\n+', ' ', val)
                val = val.strip()
                if val in ('（页面未显示）', '（页面未填写）', '暂无统计'):
                    return ''
                return val
            return ''
        
        name = extract_field(block, '姓名')
        if not name:
            continue
            
        doctor = {
            '姓名': name,
            '医院': extract_field(block, '医院'),
            '科室': extract_field(block, '科室'),
            '职称': extract_field(block, '职称'),
            '专业方向': extract_field(block, '专业方向'),
            '专业擅长': extract_field(block, '专业擅长'),
            '个人简介': extract_field(block, '个人简介'),
            '社会任职': extract_field(block, '社会任职'),
            '获奖荣誉': extract_field(block, '获奖荣誉'),
            '科研成果': extract_field(block, '科研成果'),
            '治疗经验': extract_field(block, '治疗经验'),
            '疗效满意度': extract_field(block, '疗效满意度'),
            '态度满意度': extract_field(block, '态度满意度'),
            '病友推荐度': extract_field(block, '病友推荐度'),
            'doctor_id': extract_field(block, 'doctor_id'),
            '介绍页URL': extract_field(block, '介绍页URL'),
        }
        doctors.append(doctor)
        print(f"解析: {name} ({doctor['职称']}) - {doctor['专业方向']}")
    
    return doctors

def main():
    print(f"解析文件: {INPUT_FILE}")
    doctors = parse_temp_file(INPUT_FILE)
    print(f"\n共解析到 {len(doctors)} 位医生")
    
    if not doctors:
        print("未解析到任何医生数据！")
        return
    
    df = pd.DataFrame(doctors)
    
    # 写入Excel
    with pd.ExcelWriter(OUTPUT_FILE, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='眼科医生')
        
        # 调整列宽
        ws = writer.sheets['眼科医生']
        col_widths = {
            '姓名': 10, '医院': 20, '科室': 12, '职称': 18,
            '专业方向': 20, '专业擅长': 60, '个人简介': 80,
            '社会任职': 50, '获奖荣誉': 50, '科研成果': 60,
            '治疗经验': 20, '疗效满意度': 12, '态度满意度': 12,
            '病友推荐度': 12, 'doctor_id': 15, '介绍页URL': 50
        }
        for i, col in enumerate(df.columns, 1):
            width = col_widths.get(col, 20)
            ws.column_dimensions[ws.cell(1, i).column_letter].width = width
    
    print(f"\nExcel已保存: {OUTPUT_FILE}")
    print(f"共 {len(df)} 位医生")
    print("\n职称分布:")
    print(df['职称'].value_counts().to_string())

if __name__ == '__main__':
    main()
