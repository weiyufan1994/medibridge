#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将口腔种植科临时文本文件转换为Excel和JSON格式
"""

import json
import re
from datetime import datetime
import pandas as pd

def parse_doctor_txt(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    doctors = []
    blocks = re.split(r'===医生\d+===', content)
    
    for block in blocks[1:]:
        doc = {}
        lines = block.strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if '：' in line:
                key, _, value = line.partition('：')
                key = key.strip()
                value = value.strip()
                doc[key] = value
        if doc:
            doctors.append(doc)
    
    return doctors

def build_doctor_record(doc):
    return {
        'doctor_id': doc.get('doctor_id', ''),
        '姓名': doc.get('姓名', ''),
        '职称': doc.get('职称', ''),
        '医院': doc.get('医院', '上海交通大学医学院附属第九人民医院'),
        '科室': doc.get('科室', '口腔种植科'),
        '专业方向': doc.get('专业方向', ''),
        '专业擅长': doc.get('专业擅长', ''),
        '个人简介': doc.get('个人简介', ''),
        '社会任职': doc.get('社会任职', ''),
        '科研成果': doc.get('科研成果', ''),
        '获奖荣誉': doc.get('获奖荣誉', ''),
        '教育经历': doc.get('教育经历', ''),
        '治疗经验': doc.get('治疗经验', ''),
        '病友推荐度': doc.get('病友推荐度', ''),
        '总患者数': doc.get('总患者', ''),
        '数据来源': 'haodf.com',
        '抓取日期': datetime.now().strftime('%Y-%m-%d'),
    }

def main():
    txt_path = '/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_口腔种植科_临时.txt'
    
    doctors_raw = parse_doctor_txt(txt_path)
    print(f"解析到 {len(doctors_raw)} 位医生")
    
    records = [build_doctor_record(d) for d in doctors_raw]
    
    date_str = datetime.now().strftime('%Y%m%d')
    excel_path = f'/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_口腔种植科_医生信息_{date_str}.xlsx'
    json_path = f'/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_口腔种植科_医生信息_{date_str}.json'
    
    df = pd.DataFrame(records)
    df.to_excel(excel_path, index=False, engine='openpyxl')
    print(f"Excel已保存: {excel_path}")
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"JSON已保存: {json_path}")
    
    print("\n=== 医生列表 ===")
    for r in records:
        print(f"  {r['姓名']} - {r['职称']}")
    
    return excel_path, json_path

if __name__ == '__main__':
    main()
