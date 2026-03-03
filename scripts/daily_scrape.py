#!/usr/bin/env python3
"""
每日定时抓取脚本 - 好大夫医生信息抓取
功能：
1. 检查进度文件，找出下一个待抓取的科室
2. 读取该科室的医生列表
3. 按10个一组抓取医生详细信息
4. 遇到验证码则暂停，保存已有数据并推送GitHub
5. 更新进度文件

使用方法：
    python3 scripts/daily_scrape.py

此脚本由定时任务调用，不需要手动运行。
"""

import json
import os
import sys
import subprocess
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRESS_DIR = os.path.join(BASE_DIR, 'data', 'scraping_progress')
DATA_DIR = os.path.join(BASE_DIR, 'data', 'hospitals')
SKILL_DIR = '/home/ubuntu/skills/haodf-doctor-scraper'

def load_summary():
    """加载汇总进度文件"""
    summary_file = os.path.join(PROGRESS_DIR, 'summary.json')
    with open(summary_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_hospital_progress(hospital_name):
    """加载某医院的进度文件"""
    safe_name = hospital_name.replace('/', '_').replace(' ', '_')
    progress_file = os.path.join(PROGRESS_DIR, f'{safe_name}_progress.json')
    with open(progress_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_hospital_progress(hospital_name, progress_data):
    """保存某医院的进度文件"""
    safe_name = hospital_name.replace('/', '_').replace(' ', '_')
    progress_file = os.path.join(PROGRESS_DIR, f'{safe_name}_progress.json')
    progress_data['last_updated'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(progress_file, 'w', encoding='utf-8') as f:
        json.dump(progress_data, f, ensure_ascii=False, indent=2)

def update_summary():
    """更新汇总进度文件"""
    hospitals = [
        '上海市第九人民医院', '中山医院', '华山医院',
        '瑞金医院', '复旦大学附属肿瘤医院', '上海市第六人民医院'
    ]
    total_depts = 0
    completed_depts = 0
    hosp_stats = {}

    for hosp in hospitals:
        try:
            prog = load_hospital_progress(hosp)
            total = prog['total_depts']
            completed = sum(1 for d in prog['departments'] if d['status'] == 'completed')
            total_depts += total
            completed_depts += completed
            hosp_stats[hosp] = {'total_depts': total, 'completed_depts': completed}
        except Exception:
            pass

    summary = {
        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_hospitals': len(hospitals),
        'total_depts': total_depts,
        'completed_depts': completed_depts,
        'hospitals': hosp_stats
    }
    summary_file = os.path.join(PROGRESS_DIR, 'summary.json')
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    return summary

def get_next_pending_dept():
    """找出下一个待抓取的科室"""
    hospitals = [
        '上海市第九人民医院', '中山医院', '华山医院',
        '瑞金医院', '复旦大学附属肿瘤医院', '上海市第六人民医院'
    ]
    for hosp in hospitals:
        try:
            prog = load_hospital_progress(hosp)
            for dept in prog['departments']:
                if dept['status'] == 'pending':
                    return hosp, dept
        except Exception:
            continue
    return None, None

def git_push(message):
    """推送到GitHub"""
    try:
        subprocess.run(['git', '-C', BASE_DIR, 'add', 'data/'], check=True, capture_output=True)
        subprocess.run(['git', '-C', BASE_DIR, 'commit', '-m', message], check=True, capture_output=True)
        subprocess.run(['git', '-C', BASE_DIR, 'push', 'origin', 'main'], check=True, capture_output=True)
        print(f'✅ GitHub推送成功: {message}')
        return True
    except subprocess.CalledProcessError as e:
        print(f'❌ GitHub推送失败: {e}')
        return False

def mark_dept_completed(hospital_name, dept_name, output_file, doctors_count):
    """标记科室为已完成"""
    prog = load_hospital_progress(hospital_name)
    for dept in prog['departments']:
        if dept['dept_name'] == dept_name:
            dept['status'] = 'completed'
            dept['doctors_scraped'] = doctors_count
            dept['last_updated'] = datetime.now().strftime('%Y-%m-%d')
            dept['output_file'] = output_file
            break
    prog['completed_depts'] = sum(1 for d in prog['departments'] if d['status'] == 'completed')
    save_hospital_progress(hospital_name, prog)

def mark_dept_partial(hospital_name, dept_name, doctors_scraped, doctors_total):
    """标记科室为部分完成（遇到验证码）"""
    prog = load_hospital_progress(hospital_name)
    for dept in prog['departments']:
        if dept['dept_name'] == dept_name:
            dept['status'] = 'partial'
            dept['doctors_scraped'] = doctors_scraped
            dept['doctors_total'] = doctors_total
            dept['last_updated'] = datetime.now().strftime('%Y-%m-%d')
            break
    save_hospital_progress(hospital_name, prog)

def print_status():
    """打印当前抓取状态"""
    summary = update_summary()
    print(f"\n{'='*50}")
    print(f"好大夫医生信息抓取进度报告")
    print(f"更新时间: {summary['last_updated']}")
    print(f"{'='*50}")
    print(f"总计: {summary['completed_depts']}/{summary['total_depts']} 个科室已完成")
    print()
    for hosp, stats in summary['hospitals'].items():
        pct = stats['completed_depts'] / stats['total_depts'] * 100 if stats['total_depts'] > 0 else 0
        print(f"  {hosp}: {stats['completed_depts']}/{stats['total_depts']} ({pct:.0f}%)")
    print(f"{'='*50}\n")

if __name__ == '__main__':
    print_status()
    hospital, dept = get_next_pending_dept()
    if hospital:
        print(f"下一个待抓取科室: {hospital} - {dept['dept_name']}")
        print(f"科室URL: {dept['url']}")
    else:
        print("🎉 所有科室已抓取完成！")
