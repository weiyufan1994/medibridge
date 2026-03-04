#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将并行抓取的JSON结果转换为Excel文件
用法：python3 json_to_excel.py <input_json> <output_xlsx> <dept_name>
"""

import sys
import json
import pandas as pd
from pathlib import Path

def json_to_excel(json_file, output_file, dept_name=""):
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    results = data.get('results', [])
    doctors = []
    skipped = 0
    
    for item in results:
        output = item.get('output', {})
        
        if not output:
            skipped += 1
            print(f"跳过空条目: input={item.get('input','')}")
            continue
        
        # 以姓名是否有效来判断（不依赖success字段）
        name = output.get('name', '').strip()
        invalid_names = ['', '（页面未显示）', '页面无法访问', '页面无法访问或医生信息未收录', 
                         '医生信息未收录', '该医生信息未收录', None]
        if not name or name in invalid_names or '无法访问' in name or '未收录' in name:
            skipped += 1
            print(f"跳过无效条目: input={item.get('input','')}, name={name}")
            continue
        
        doctor = {
            '医院': output.get('hospital', '上海市第九人民医院'),
            '科室': output.get('department', dept_name),
            '姓名': name,
            '职称': output.get('title', ''),
            '专业方向': output.get('specialty_direction', ''),
            '专业擅长': output.get('specialty_skills', ''),
            '个人简介': output.get('biography', ''),
            '社会任职': output.get('social_positions', ''),
            '科研成果': output.get('research', ''),
            '治疗经验': output.get('treatment_experience', ''),
            '疗效满意度': output.get('efficacy_satisfaction', ''),
            '态度满意度': output.get('attitude_satisfaction', ''),
            '病友推荐度': output.get('recommendation_score', ''),
            'doctor_id': output.get('doctor_id', item.get('input', '')),
            '医生介绍页URL': output.get('url', output.get('profile_url', f"https://www.haodf.com/doctor/{item.get('input','')}/xinxi-jieshao.html")),
        }
        doctors.append(doctor)
    
    print(f"共 {len(doctors)} 位有效医生，跳过 {skipped} 条无效记录")
    
    if not doctors:
        print("无有效数据，退出")
        return 0
    
    df = pd.DataFrame(doctors)
    df.insert(0, '序号', range(1, len(df) + 1))
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        sheet_name = dept_name[:31] if dept_name else '医生信息'
        df.to_excel(writer, index=False, sheet_name=sheet_name)
        
        ws = writer.sheets[sheet_name]
        col_widths = {
            'A': 6, 'B': 20, 'C': 12, 'D': 10, 'E': 15,
            'F': 20, 'G': 40, 'H': 60, 'I': 30, 'J': 40,
            'K': 30, 'L': 12, 'M': 12, 'N': 12, 'O': 15, 'P': 50
        }
        for col, width in col_widths.items():
            ws.column_dimensions[col].width = width
    
    print(f"Excel已保存: {output_file}")
    return len(doctors)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法: python3 json_to_excel.py <input_json> <output_xlsx> [dept_name]")
        sys.exit(1)
    
    json_file = sys.argv[1]
    output_file = sys.argv[2]
    dept_name = sys.argv[3] if len(sys.argv) > 3 else ""
    
    count = json_to_excel(json_file, output_file, dept_name)
    print(f"完成！共处理 {count} 位医生")
