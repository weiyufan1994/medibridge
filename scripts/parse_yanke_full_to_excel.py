#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解析上海市第九人民医院眼科临时文件，生成Excel
"""

import re
import pandas as pd
from pathlib import Path

def parse_temp_file(filepath):
    """解析临时文件，提取所有医生信息"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 按医生分隔符分割
    sections = re.split(r'---医生\d+---', content)
    
    doctors = []
    for section in sections:
        section = section.strip()
        if not section or section.startswith('#'):
            continue
        
        # 解析字段
        def extract_field(text, field_name):
            pattern = rf'^{re.escape(field_name)}:\s*(.+?)(?=\n\w|$)'
            match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
            if match:
                value = match.group(1).strip()
                # 清理多行值（取第一行或合并）
                value = ' '.join(value.split('\n')).strip()
                return value
            return ''
        
        # 检查是否为跳过记录
        if '跳过' in section or '未被收录' in section or '护士' in section:
            continue
        
        # 必须有姓名字段
        name = extract_field(section, '姓名')
        if not name:
            continue
        
        doctor = {
            '姓名': name,
            '医院': extract_field(section, '医院'),
            '科室': extract_field(section, '科室'),
            '职称': extract_field(section, '职称'),
            '专业方向': extract_field(section, '专业方向'),
            '专业擅长': extract_field(section, '专业擅长'),
            '个人简介': extract_field(section, '个人简介'),
            '社会任职': extract_field(section, '社会任职'),
            '获奖荣誉': extract_field(section, '获奖荣誉'),
            '科研成果': extract_field(section, '科研成果'),
            '治疗经验': extract_field(section, '治疗经验'),
            '疗效满意度': extract_field(section, '疗效满意度'),
            '态度满意度': extract_field(section, '态度满意度'),
            '病友推荐度': extract_field(section, '病友推荐度'),
            'doctor_id': extract_field(section, 'doctor_id'),
            '介绍页URL': extract_field(section, '介绍页URL'),
        }
        
        # 过滤掉空记录
        if doctor['姓名'] and doctor['姓名'] not in ['（页面未显示）', '']:
            doctors.append(doctor)
    
    return doctors

def main():
    input_file = Path('/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_眼科_临时.txt')
    output_file = Path('/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_眼科_医生详细信息.xlsx')
    
    print(f"解析文件: {input_file}")
    doctors = parse_temp_file(input_file)
    print(f"共解析到 {len(doctors)} 位医生")
    
    if not doctors:
        print("未解析到任何医生数据，请检查文件格式")
        return
    
    # 去重（按姓名+doctor_id）
    seen = set()
    unique_doctors = []
    for d in doctors:
        key = (d['姓名'], d['doctor_id'])
        if key not in seen:
            seen.add(key)
            unique_doctors.append(d)
    
    print(f"去重后共 {len(unique_doctors)} 位医生")
    
    # 创建DataFrame
    df = pd.DataFrame(unique_doctors)
    
    # 重置序号
    df.insert(0, '序号', range(1, len(df) + 1))
    
    # 写入Excel
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='眼科医生信息')
        
        # 调整列宽
        worksheet = writer.sheets['眼科医生信息']
        col_widths = {
            'A': 6,   # 序号
            'B': 10,  # 姓名
            'C': 20,  # 医院
            'D': 12,  # 科室
            'E': 15,  # 职称
            'F': 25,  # 专业方向
            'G': 40,  # 专业擅长
            'H': 60,  # 个人简介
            'I': 30,  # 社会任职
            'J': 30,  # 获奖荣誉
            'K': 40,  # 科研成果
            'L': 15,  # 治疗经验
            'M': 12,  # 疗效满意度
            'N': 12,  # 态度满意度
            'O': 12,  # 病友推荐度
            'P': 15,  # doctor_id
            'Q': 50,  # 介绍页URL
        }
        for col, width in col_widths.items():
            worksheet.column_dimensions[col].width = width
    
    print(f"Excel已保存至: {output_file}")
    
    # 打印统计信息
    print("\n职称分布:")
    print(df['职称'].value_counts())
    
    print("\n前10位医生:")
    for _, row in df.head(10).iterrows():
        print(f"  {row['序号']}. {row['姓名']} - {row['职称']}")

if __name__ == '__main__':
    main()
