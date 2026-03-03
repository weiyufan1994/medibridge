#!/usr/bin/env python3
"""
初始化抓取进度追踪系统
生成 data/scraping_progress/ 目录下的进度文件
"""

import openpyxl
import json
import os
from datetime import datetime

HOSPITALS = {
    '上海市第九人民医院': 'data/hospitals/上海市第九人民医院.xlsx',
    '中山医院': 'data/hospitals/中山医院.xlsx',
    '华山医院': 'data/hospitals/华山医院.xlsx',
    '瑞金医院': 'data/hospitals/瑞金医院.xlsx',
    '复旦大学附属肿瘤医院': 'data/hospitals/复旦大学附属肿瘤医院.xlsx',
    '上海市第六人民医院': 'data/hospitals/上海市第六人民医院.xlsx',
}

# 已完成的科室（从现有数据文件中识别）
COMPLETED_DEPTS = {
    '上海市第九人民医院': [
        '口腔特需科',
        '儿童口腔科',
        '口腔预防科',
        '牙周病科',
        '牙体牙髓科',
        '口腔正畸科',
        '口腔科',  # 综合口腔科
    ],
    '中山医院': [
        '呼吸科',
    ],
}

def load_departments(filepath):
    """从Excel文件加载科室列表"""
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active
    depts = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] and row[1] and 'haodf.com' in str(row[1]):
            depts.append({
                'dept_name': str(row[0]).strip(),
                'url': str(row[1]).strip(),
            })
    return depts

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    progress_dir = os.path.join(base_dir, 'data', 'scraping_progress')
    os.makedirs(progress_dir, exist_ok=True)

    all_progress = {}

    for hosp_name, xlsx_path in HOSPITALS.items():
        full_path = os.path.join(base_dir, xlsx_path)
        if not os.path.exists(full_path):
            print(f'警告: 找不到文件 {full_path}')
            continue

        depts = load_departments(full_path)
        completed = COMPLETED_DEPTS.get(hosp_name, [])

        hosp_progress = {
            'hospital_name': hosp_name,
            'total_depts': len(depts),
            'completed_depts': 0,
            'departments': []
        }

        for dept in depts:
            is_completed = dept['dept_name'] in completed
            dept_entry = {
                'dept_name': dept['dept_name'],
                'url': dept['url'],
                'status': 'completed' if is_completed else 'pending',
                'doctors_scraped': 0,
                'doctors_total': 0,
                'last_updated': datetime.now().strftime('%Y-%m-%d') if is_completed else None,
                'output_file': None,
            }
            if is_completed:
                hosp_progress['completed_depts'] += 1
            hosp_progress['departments'].append(dept_entry)

        all_progress[hosp_name] = hosp_progress

        # 保存每个医院的进度文件
        safe_name = hosp_name.replace('/', '_').replace(' ', '_')
        progress_file = os.path.join(progress_dir, f'{safe_name}_progress.json')
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(hosp_progress, f, ensure_ascii=False, indent=2)

        print(f'{hosp_name}: {len(depts)} 个科室，已完成 {hosp_progress["completed_depts"]} 个')

    # 保存汇总进度文件
    summary = {
        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_hospitals': len(all_progress),
        'total_depts': sum(h['total_depts'] for h in all_progress.values()),
        'completed_depts': sum(h['completed_depts'] for h in all_progress.values()),
        'hospitals': {k: {
            'total_depts': v['total_depts'],
            'completed_depts': v['completed_depts'],
        } for k, v in all_progress.items()}
    }

    summary_file = os.path.join(progress_dir, 'summary.json')
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f'\n总计: {summary["total_depts"]} 个科室，已完成 {summary["completed_depts"]} 个')
    print(f'进度文件已保存到: {progress_dir}')

if __name__ == '__main__':
    main()
