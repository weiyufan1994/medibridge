import requests
from bs4 import BeautifulSoup
import re
import time
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': 'https://www.haodf.com/',
}

# 中山医院各科室URL（keshi_id -> 科室名）
departments = {
    '9597812971': '胃肠外科',
    '9597812974': '胆道外科',
    '9597812973': '甲状腺乳腺外科',
    '9597810913': '结直肠外科',
    '9597810608': '胰腺外科',
    '1791': '整形外科',
    '5450443356': '内镜中心',
    '1785': '血管外科',
    '1784': '胸外科',
    '1783': '心脏外科',
    '1764': '肝胆肿瘤与肝移植外科',
    '1779': '心内科',
    '1778': '消化科',
    '1772': '内分泌科',
    '1780': '肾内科',
    '1776': '神经内科',
    '1773': '感染病科',
    '1774': '风湿免疫科',
    '1775': '血液科',
    '1770': '肿瘤科',
    '1769': '放射科',
    '1771': '超声科',
    '1768': '核医学科',
    '1767': '放疗科',
}

all_doctors = {}

for keshi_id, dept_name in departments.items():
    print(f"\n获取 {dept_name} (keshi/{keshi_id})...")
    doctors = []
    page = 1
    
    while True:
        url = f'https://www.haodf.com/hospital/420/keshi/{keshi_id}/tuijian.html?p={page}'
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                print(f"  页面{page} 状态码: {resp.status_code}")
                break
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # 查找医生链接
            doctor_links = soup.find_all('a', href=re.compile(r'/doctor/\d+\.html'))
            
            if not doctor_links:
                print(f"  页面{page} 无医生链接，停止")
                break
            
            page_doctors = []
            for link in doctor_links:
                href = link.get('href', '')
                match = re.search(r'/doctor/(\d+)\.html', href)
                if match:
                    doctor_id = match.group(1)
                    # 获取医生姓名
                    name_tag = link.find(['h2', 'h3', 'strong', 'span'])
                    name = name_tag.get_text(strip=True) if name_tag else link.get_text(strip=True)[:10]
                    page_doctors.append({'id': doctor_id, 'name': name})
            
            # 去重
            existing_ids = {d['id'] for d in doctors}
            new_doctors = [d for d in page_doctors if d['id'] not in existing_ids]
            
            if not new_doctors:
                print(f"  页面{page} 无新医生，停止")
                break
            
            doctors.extend(new_doctors)
            print(f"  页面{page}: +{len(new_doctors)} 位 (累计 {len(doctors)} 位)")
            
            page += 1
            time.sleep(1)
            
        except Exception as e:
            print(f"  页面{page} 出错: {e}")
            break
    
    all_doctors[dept_name] = doctors
    print(f"  {dept_name} 共 {len(doctors)} 位医生")

# 保存结果
output_file = '/home/ubuntu/medibridge/data/hospitals/中山医院_所有科室医生ID.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(all_doctors, f, ensure_ascii=False, indent=2)

print(f"\n\n=== 汇总 ===")
total = 0
for dept, docs in all_doctors.items():
    print(f"{dept}: {len(docs)} 位")
    total += len(docs)
print(f"总计: {total} 位医生")
print(f"已保存至: {output_file}")
