#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parse doctor information from 九院 temporary text file and export to Excel.
Handles the format: ---医生N（ID: XXXXX）--- or ---医生N---

Usage:
    python3 parse_jiuyuan_to_excel.py <input_txt_file> <output_xlsx_file>
"""

import sys
import re
import pandas as pd


def parse_doctor_info(content):
    """Parse doctor information from text content."""
    # Split by doctor sections using the ---医生N--- pattern
    # Handles both ---医生N--- and ---医生N（ID: XXXXX）---
    sections = re.split(r'\n---医生\d+[^-]*---\n', content)
    
    # Skip the header section (first element)
    doctors_raw = sections[1:]
    
    doctors_data = []
    
    field_map = {
        "姓名": "姓名",
        "医院": "医院",
        "科室": "科室",
        "职称": "职称",
        "专业方向": "专业方向",
        "专业擅长": "专业擅长",
        "个人简介": "个人简介",
        "社会任职": "社会任职",
        "获奖荣誉": "获奖荣誉",
        "科研成果": "科研成果",
        "治疗经验": "治疗经验",
        "疗效满意度": "疗效满意度",
        "态度满意度": "态度满意度",
        "病友推荐度": "病友推荐度",
        "doctor_id": "doctor_id",
        "介绍页URL": "医生介绍页URL",
    }
    
    for doctor_raw in doctors_raw:
        if not doctor_raw.strip():
            continue
            
        lines = doctor_raw.strip().split('\n')
        
        # Initialize doctor info with all fields
        doctor_info = {
            "医院": "",
            "科室": "",
            "姓名": "",
            "职称": "",
            "专业方向": "",
            "专业擅长": "",
            "个人简介": "",
            "社会任职": "",
            "获奖荣誉": "",
            "科研成果": "",
            "治疗经验": "",
            "疗效满意度": "",
            "态度满意度": "",
            "病友推荐度": "",
            "doctor_id": "",
            "医生介绍页URL": ""
        }
        
        current_key = None
        current_value_lines = []
        
        for line in lines:
            if ': ' in line or line.endswith(':'):
                # Save previous key-value pair
                if current_key and current_key in field_map:
                    mapped_key = field_map[current_key]
                    doctor_info[mapped_key] = '\n'.join(current_value_lines).strip()
                
                # Parse new key-value
                if ': ' in line:
                    key, value = line.split(': ', 1)
                    current_key = key.strip()
                    current_value_lines = [value.strip()]
                else:
                    current_key = line.rstrip(':').strip()
                    current_value_lines = []
            elif current_key:
                current_value_lines.append(line)
        
        # Save last key-value pair
        if current_key and current_key in field_map:
            mapped_key = field_map[current_key]
            doctor_info[mapped_key] = '\n'.join(current_value_lines).strip()
        
        # Only add if we have a name
        if doctor_info["姓名"]:
            doctors_data.append(doctor_info)
    
    return doctors_data


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 parse_jiuyuan_to_excel.py <input_txt_file> <output_xlsx_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # Read input file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(1)
    
    # Parse doctor information
    doctors_data = parse_doctor_info(content)
    
    if not doctors_data:
        print("Warning: No doctor information found in input file")
        sys.exit(1)
    
    # Create DataFrame with ordered columns
    columns = ["医院", "科室", "姓名", "职称", "专业方向", "专业擅长", "个人简介",
               "社会任职", "获奖荣誉", "科研成果", "治疗经验", "疗效满意度", "态度满意度",
               "病友推荐度", "doctor_id", "医生介绍页URL"]
    
    df = pd.DataFrame(doctors_data, columns=columns)
    
    # Save to Excel
    try:
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='医生信息')
            
            # Auto-adjust column widths
            worksheet = writer.sheets['医生信息']
            for idx, col in enumerate(df.columns):
                max_len = max(
                    df[col].astype(str).map(len).max(),
                    len(col)
                )
                # Cap at 60 chars for readability
                adjusted_width = min(max_len + 2, 60)
                worksheet.column_dimensions[chr(65 + idx)].width = adjusted_width
        
        print(f"✓ Successfully created Excel file: {output_file}")
        print(f"✓ Total doctors: {len(doctors_data)}")
        print(f"✓ Total fields: {len(columns)}")
        
        # Print completeness stats
        print("\n字段完整性统计：")
        for col in columns:
            non_empty = df[col].apply(lambda x: bool(x) and x not in ['暂无', '暂无统计', '暂无简介']).sum()
            pct = non_empty / len(df) * 100
            print(f"  {col}: {non_empty}/{len(df)} ({pct:.0f}%)")
            
    except Exception as e:
        print(f"Error writing Excel file: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
