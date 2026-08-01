#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
激光美容科数据转换脚本
将临时txt文件转换为Excel和JSON格式
"""

import json
import re
import os
import pandas as pd
from datetime import datetime

# 文件路径
TXT_FILE = "/home/ubuntu/medibridge/data/hospitals/上海市第九人民医院_激光美容科_临时.txt"
OUTPUT_DIR = "/home/ubuntu/medibridge/data/hospitals"
DEPT_NAME = "激光美容科"
HOSPITAL_NAME = "上海市第九人民医院"

def parse_doctors(txt_file):
    """解析临时txt文件，提取医生信息"""
    with open(txt_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 按医生分割
    doctor_blocks = re.split(r'===医生\d+===', content)
    doctor_blocks = [b.strip() for b in doctor_blocks if b.strip() and not b.strip().startswith('#')]
    
    doctors = []
    for block in doctor_blocks:
        doctor = {}
        lines = block.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('姓名：'):
                doctor['姓名'] = line[3:]
            elif line.startswith('职称：'):
                doctor['职称'] = line[3:]
            elif line.startswith('doctor_id：'):
                doctor['doctor_id'] = line[10:]
            elif line.startswith('医院：'):
                doctor['医院'] = line[3:]
            elif line.startswith('科室：'):
                doctor['科室'] = line[3:]
            elif line.startswith('专业方向：'):
                doctor['专业方向'] = line[5:]
            elif line.startswith('专业擅长：'):
                doctor['专业擅长'] = line[5:]
            elif line.startswith('个人简介：'):
                doctor['个人简介'] = line[5:]
            elif line.startswith('社会任职：'):
                doctor['社会任职'] = line[5:]
            elif line.startswith('获奖荣誉：'):
                doctor['获奖荣誉'] = line[5:]
            elif line.startswith('科研成果：'):
                doctor['科研成果'] = line[5:]
            elif line.startswith('病友推荐度：'):
                doctor['病友推荐度'] = line[6:]
            elif line.startswith('总患者：'):
                doctor['总患者'] = line[4:]
        
        if doctor.get('姓名'):
            # 补充缺失字段
            for field in ['姓名', '职称', 'doctor_id', '医院', '科室', '专业方向', 
                         '专业擅长', '个人简介', '社会任职', '获奖荣誉', '科研成果', 
                         '病友推荐度', '总患者']:
                if field not in doctor:
                    doctor[field] = '暂无'
            
            # 添加好大夫链接
            doctor['好大夫链接'] = f"https://www.haodf.com/doctor/{doctor['doctor_id']}.html"
            doctors.append(doctor)
    
    return doctors

def save_to_excel(doctors, output_dir, hospital, dept):
    """保存为Excel文件"""
    df = pd.DataFrame(doctors)
    
    # 调整列顺序
    cols = ['姓名', '职称', 'doctor_id', '医院', '科室', '专业方向', 
            '专业擅长', '个人简介', '社会任职', '获奖荣誉', '科研成果', 
            '病友推荐度', '总患者', '好大夫链接']
    df = df.reindex(columns=cols)
    
    filename = f"{hospital}_{dept}.xlsx"
    filepath = os.path.join(output_dir, filename)
    df.to_excel(filepath, index=False, engine='openpyxl')
    print(f"✅ Excel已保存: {filepath}")
    return filepath

def save_to_json(doctors, output_dir, hospital, dept):
    """保存为JSON文件"""
    data = {
        "hospital": hospital,
        "department": dept,
        "scrape_date": datetime.now().strftime("%Y-%m-%d"),
        "total_doctors": len(doctors),
        "doctors": doctors
    }
    
    filename = f"{hospital}_{dept}.json"
    filepath = os.path.join(output_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ JSON已保存: {filepath}")
    return filepath

if __name__ == "__main__":
    print(f"开始转换 {HOSPITAL_NAME} {DEPT_NAME} 数据...")
    
    doctors = parse_doctors(TXT_FILE)
    print(f"共解析到 {len(doctors)} 位医生")
    
    save_to_excel(doctors, OUTPUT_DIR, HOSPITAL_NAME, DEPT_NAME)
    save_to_json(doctors, OUTPUT_DIR, HOSPITAL_NAME, DEPT_NAME)
    
    print("转换完成！")
