#!/usr/bin/env python3
"""
进度跟踪系统
- 检查已抓取的科室
- 返回下一个待抓取的科室
"""

import json
import os
from pathlib import Path


def parse_department_from_filename(filename: str) -> str:
    base = filename[:-5] if filename.lower().endswith('.xlsx') else filename
    base = base.strip()
    if not base:
        return ''

    # New style: {科室}_医生详细信息_YYYYMMDD.xlsx (date suffix optional)
    marker_new = '_医生详细信息'
    if marker_new in base:
        return base.split(marker_new, 1)[0].strip()

    # Legacy style: {医院}_{科室}_医生信息_YYYYMMDD.xlsx
    marker_old = '_医生信息'
    if marker_old not in base:
        return ''

    prefix = base.split(marker_old, 1)[0].strip()
    parts = [x.strip() for x in prefix.split('_') if x.strip()]
    if len(parts) > 1:
        return parts[-1]
    return prefix

class ProgressTracker:
    def __init__(self):
        env_base = os.getenv('MEDIBRIDGE_BASE_DIR')
        if env_base:
            self.base_dir = Path(env_base)
        else:
            self.base_dir = Path(__file__).resolve().parent.parent
        self.departments_file = self.base_dir / 'data/departments/all_departments.json'
        self.hospitals_dir = self.base_dir / 'data/hospitals'
        self.progress_file = self.base_dir / 'data/departments/progress.json'
        
    def load_all_departments(self):
        """加载所有科室列表"""
        with open(self.departments_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_scraped_departments(self):
        """获取已抓取的科室列表"""
        scraped = set()

        if not self.hospitals_dir.exists():
            return scraped

        # 新目录规则：data/hospitals/{医院名称}/{科室}_医生详细信息_YYYYMMDD.xlsx
        # 同时兼容历史命名：{医院}_{科室}_医生信息_YYYYMMDD.xlsx
        for hospital_dir in self.hospitals_dir.iterdir():
            if not hospital_dir.is_dir():
                continue

            hospital = hospital_dir.name.strip()
            if not hospital:
                continue

            for file_path in hospital_dir.glob('*.xlsx'):
                filename = file_path.name
                if '医生信息' not in filename and '医生详细信息' not in filename:
                    continue

                department = parse_department_from_filename(filename)
                if not department:
                    continue

                key = f"{hospital}_{department}"
                scraped.add(key)
        
        return scraped
    
    def get_next_department(self):
        """获取下一个待抓取的科室"""
        all_depts = self.load_all_departments()
        scraped = self.get_scraped_departments()
        
        for dept in all_depts:
            key = f"{dept['hospital']}_{dept['department']}"
            if key not in scraped:
                return dept
        
        return None
    
    def get_progress_stats(self):
        """获取进度统计"""
        all_depts = self.load_all_departments()
        scraped = self.get_scraped_departments()
        
        total = len(all_depts)
        completed = len(scraped)
        remaining = total - completed
        
        # 按医院统计
        hospital_stats = {}
        for dept in all_depts:
            hospital = dept['hospital']
            if hospital not in hospital_stats:
                hospital_stats[hospital] = {'total': 0, 'completed': 0}
            hospital_stats[hospital]['total'] += 1
            
            key = f"{hospital}_{dept['department']}"
            if key in scraped:
                hospital_stats[hospital]['completed'] += 1
        
        return {
            'total': total,
            'completed': completed,
            'remaining': remaining,
            'progress_percent': round(completed / total * 100, 2) if total > 0 else 0,
            'hospital_stats': hospital_stats
        }
    
    def save_progress(self, department, status, message=''):
        """保存抓取进度"""
        progress_data = {
            'hospital': department['hospital'],
            'department': department['department'],
            'url': department['url'],
            'status': status,  # 'success', 'failed', 'captcha'
            'message': message,
            'timestamp': __import__('datetime').datetime.now().isoformat()
        }
        
        # 追加到进度文件
        progress_log = []
        if self.progress_file.exists():
            with open(self.progress_file, 'r', encoding='utf-8') as f:
                progress_log = json.load(f)
        
        progress_log.append(progress_data)
        
        with open(self.progress_file, 'w', encoding='utf-8') as f:
            json.dump(progress_log, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    tracker = ProgressTracker()
    
    # 显示进度统计
    stats = tracker.get_progress_stats()
    print(f"总科室数: {stats['total']}")
    print(f"已完成: {stats['completed']}")
    print(f"剩余: {stats['remaining']}")
    print(f"进度: {stats['progress_percent']}%")
    
    print("\n按医院统计:")
    for hospital, data in sorted(stats['hospital_stats'].items()):
        print(f"  {hospital}: {data['completed']}/{data['total']}")
    
    # 获取下一个待抓取的科室
    next_dept = tracker.get_next_department()
    if next_dept:
        print(f"\n下一个待抓取科室:")
        print(f"  医院: {next_dept['hospital']}")
        print(f"  科室: {next_dept['department']}")
        print(f"  URL: {next_dept['url']}")
    else:
        print("\n✅ 所有科室已抓取完成！")
