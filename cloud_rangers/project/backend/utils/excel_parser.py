import os
import re
import logging
import pandas as pd
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Absolute paths setup
_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_dir = os.path.dirname(os.path.dirname(_current_dir))
EXCEL_PATH = os.path.join(_project_dir, 'dataset', 'additive_regulatory_report.xlsx')

class AdditiveRegulatoryReportManager:
    _instance = None
    _cached_data = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(AdditiveRegulatoryReportManager, cls).__new__(cls, *args, **kwargs)
        return cls._instance

    def __init__(self):
        if self._cached_data is None:
            self.load_and_cache()

    def load_and_cache(self):
        """Loads and processes the Excel dataset into an in-memory dictionary for rapid lookup."""
        if not os.path.exists(EXCEL_PATH):
            logger.error(f"Excel dataset not found at: {EXCEL_PATH}")
            self._cached_data = {
                "limits": {},
                "eu_banned": {},
                "recalls": []
            }
            return

        try:
            logger.info(f"Parsing Excel regulatory report from {EXCEL_PATH}")
            xl = pd.ExcelFile(EXCEL_PATH)
            
            # 1. Load Additive_Limits
            limits_df = pd.read_excel(xl, 'Additive_Limits') if 'Additive_Limits' in xl.sheet_names else pd.DataFrame()
            # 2. Load EU_Not_Authorised_Additives
            eu_banned_df = pd.read_excel(xl, 'EU_Not_Authorised_Additives') if 'EU_Not_Authorised_Additives' in xl.sheet_names else pd.DataFrame()
            # 3. Load Recall_Incidents
            recalls_df = pd.read_excel(xl, 'Recall_Incidents') if 'Recall_Incidents' in xl.sheet_names else pd.DataFrame()

            self._cached_data = {
                "limits": self._process_limits(limits_df),
                "eu_banned": self._process_eu_banned(eu_banned_df),
                "recalls": recalls_df.to_dict(orient='records')
            }
            logger.info("Successfully cached Excel data.")
        except Exception as e:
            logger.exception("Error loading Excel regulatory dataset")
            self._cached_data = {"limits": {}, "eu_banned": {}, "recalls": []}

    def _process_limits(self, df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
        """Indexes limits rows by normalized names and INS/E codes."""
        indexed = {}
        if df.empty:
            return indexed

        # Strip any whitespace from column names
        df.columns = [col.strip() for col in df.columns]

        for _, row in df.iterrows():
            ingredient = str(row.get('Ingredient', '')).strip()
            ins_no = str(row.get('INS / E No.', '')).strip()
            if not ingredient or ingredient == 'nan':
                continue

            row_dict = {
                "table_group": str(row.get('Table_Group', 'Data Not Available')).strip(),
                "product": str(row.get('Product', 'Data Not Available')).strip(),
                "ingredient": ingredient,
                "ins_no": ins_no,
                "function": str(row.get('Function', 'Data Not Available')).strip(),
                "food_category": str(row.get('Food Category', 'Data Not Available')).strip(),
                "jurisdiction": str(row.get('Jurisdiction', 'Data Not Available')).strip(),
                "status_limit": str(row.get('Status / Limit', 'Data Not Available')).strip(),
                "notes": str(row.get('Difference / Notes', 'Data Not Available')).strip(),
                "source": str(row.get('Source', 'Data Not Available')).strip()
            }

            # Generate normalized keys for matching
            keys = set()
            keys.add(self._normalize_str(ingredient))
            
            # Split INS codes and E codes
            if ins_no and ins_no != 'nan':
                # e.g. "INS 476 / E476"
                parts = re.split(r'[/,;]', ins_no.lower())
                for part in parts:
                    clean_part = re.sub(r'[^a-z0-9]', '', part.strip())
                    if clean_part:
                        keys.add(clean_part)

            # Store the entry under all its keys
            for key in keys:
                if key not in indexed:
                    indexed[key] = []
                indexed[key].append(row_dict)

        return indexed

    def _process_eu_banned(self, df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        """Indexes EU banned additives by normalized names and identifier."""
        indexed = {}
        if df.empty:
            return indexed

        df.columns = [col.strip() for col in df.columns]
        for _, row in df.iterrows():
            ingredient = str(row.get('Ingredient', '')).strip()
            identifier = str(row.get('E-number / Identifier', '')).strip()
            if not ingredient or ingredient == 'nan':
                continue

            entry = {
                "ingredient": ingredient,
                "identifier": identifier,
                "function": str(row.get('Function', 'Data Not Available')).strip(),
                "commonly_found_in": str(row.get('Commonly Found In (Indian Products)', 'Data Not Available')).strip(),
                "eu_status": str(row.get('EU Status', 'Data Not Available')).strip(),
                "reason": str(row.get('Reason', 'Data Not Available')).strip()
            }

            keys = set()
            keys.add(self._normalize_str(ingredient))
            if identifier and identifier != 'nan':
                clean_id = re.sub(r'[^a-z0-9]', '', identifier.lower().strip())
                if clean_id:
                    keys.add(clean_id)

            for key in keys:
                indexed[key] = entry

        return indexed

    def _normalize_str(self, s: str) -> str:
        """Helper to convert to lower case and strip special characters."""
        return re.sub(r'[^a-z0-9]', '', s.lower().strip())

    def _extract_ins_or_e(self, ingredient_name: str) -> List[str]:
        """Extracts possible INS/E numbers from an ingredient text, e.g. E330, INS 476."""
        found = []
        # Match INS/E numbers like E120, INS 322, E-330
        matches = re.findall(r'\b(?:ins|e)[\s-]*(\d+[a-z]*)\b', ingredient_name.lower())
        for match in matches:
            found.append(f"ins{match}")
            found.append(f"e{match}")
        return found

    def lookup_additive(self, ingredient_name: str) -> Dict[str, Any]:
        """Looks up an ingredient in cached dataset by name or E/INS numbers. Returns consolidated data."""
        normalized_name = self._normalize_str(ingredient_name)
        extracted_codes = self._extract_ins_or_e(ingredient_name)

        # Gather matching records from the cached structures
        matched_records = []
        eu_ban_record = None

        # 1. Search by extracted INS/E codes
        for code in extracted_codes:
            if code in self._cached_data["limits"]:
                matched_records.extend(self._cached_data["limits"][code])
            if code in self._cached_data["eu_banned"]:
                eu_ban_record = self._cached_data["eu_banned"][code]

        # 2. Search by normalized name
        # We also check for substring matching (e.g. "soy lecithin" matches "lecithin")
        for key, records in self._cached_data["limits"].items():
            if key in normalized_name or normalized_name in key:
                matched_records.extend(records)

        for key, record in self._cached_data["eu_banned"].items():
            if key in normalized_name or normalized_name in key:
                eu_ban_record = record

        if not matched_records and not eu_ban_record:
            return {}

        # De-duplicate matched records
        unique_records = []
        seen_rec = set()
        for r in matched_records:
            r_id = (r["ingredient"], r["jurisdiction"], r["status_limit"])
            if r_id not in seen_rec:
                seen_rec.add(r_id)
                unique_records.append(r)

        # Consolidate properties
        name = ingredient_name
        ins_no = "Data Not Available"
        function = "Data Not Available"
        notes = "Data Not Available"
        health_reason = "Data Not Available"

        if unique_records:
            rec = unique_records[0]
            name = rec["ingredient"]
            ins_no = rec["ins_no"]
            function = rec["function"]
            notes = rec["notes"]

        if eu_ban_record:
            name = eu_ban_record["ingredient"]
            if ins_no == "Data Not Available" and eu_ban_record["identifier"]:
                ins_no = eu_ban_record["identifier"]
            if function == "Data Not Available":
                function = eu_ban_record["function"]
            health_reason = eu_ban_record["reason"]

        # Parse E/INS details cleanly if not explicitly present
        if ins_no == "Data Not Available" or not ins_no or ins_no == 'nan':
            # Extract from name
            matches = re.findall(r'\b(?:ins|e)[\s-]*(\d+[a-z]*)\b', name.lower())
            if matches:
                ins_no = f"INS {matches[0]} / E{matches[0]}"

        # Country Regulations mapping
        countries_data = {
            "India (FSSAI)": {"status": "Not Available", "limit": "Data Not Available", "authority": "FSSAI"},
            "USA (FDA)": {"status": "Not Available", "limit": "Data Not Available", "authority": "FDA"},
            "European Union (EFSA)": {"status": "Not Available", "limit": "Data Not Available", "authority": "EFSA"},
            "United Kingdom": {"status": "Not Available", "limit": "Data Not Available", "authority": "FSA"},
            "Canada": {"status": "Not Available", "limit": "Data Not Available", "authority": "Health Canada"},
            "Australia / New Zealand": {"status": "Not Available", "limit": "Data Not Available", "authority": "FSANZ"},
            "Japan": {"status": "Not Available", "limit": "Data Not Available", "authority": "MHLW"},
        }

        # Fill records from Excel Additive_Limits
        for r in unique_records:
            jur = r["jurisdiction"].lower()
            status_lim = r["status_limit"]
            notes_str = r["notes"]

            target_country = None
            if "india" in jur or "fssai" in jur:
                target_country = "India (FSSAI)"
            elif "usa" in jur or "fda" in jur or "us " in jur:
                target_country = "USA (FDA)"
            elif "eu" in jur or "european" in jur or "efsa" in jur:
                target_country = "European Union (EFSA)"
            elif "uk" in jur or "united kingdom" in jur or "fsa" in jur:
                target_country = "United Kingdom"
            elif "canada" in jur:
                target_country = "Canada"
            elif "australia" in jur or "new zealand" in jur or "anz" in jur or "fsanz" in jur:
                target_country = "Australia / New Zealand"
            elif "japan" in jur:
                target_country = "Japan"

            if target_country:
                status, limit = self._parse_status_and_limit(status_lim)
                countries_data[target_country]["status"] = status
                countries_data[target_country]["limit"] = limit
                if notes_str and notes_str != 'nan' and notes_str != 'Data Not Available':
                    countries_data[target_country]["notes"] = notes_str

        # Apply EU banned override if applicable
        if eu_ban_record:
            eu_status = eu_ban_record["eu_status"].lower()
            if "not authorised" in eu_status or "prohibited" in eu_status or "banned" in eu_status:
                countries_data["European Union (EFSA)"]["status"] = "Banned"
                countries_data["European Union (EFSA)"]["limit"] = "Prohibited"
                countries_data["European Union (EFSA)"]["notes"] = eu_ban_record["reason"]
                
                # Align UK default status in case EU bans it
                if countries_data["United Kingdom"]["status"] == "Not Available":
                    countries_data["United Kingdom"]["status"] = "Banned"
                    countries_data["United Kingdom"]["limit"] = "Prohibited"
                    countries_data["United Kingdom"]["notes"] = eu_ban_record["reason"]

        # Deduce overall risk level based on country approvals
        risk_level = "Low Risk"
        statuses = [c["status"] for c in countries_data.values()]
        
        if "Banned" in statuses:
            risk_level = "High Risk"
        elif "Restricted" in statuses:
            risk_level = "Moderate Risk"

        # Check for recalls involving this brand or contaminant
        recalls_notices = []
        for rec in self._cached_data["recalls"]:
            brand_name = str(rec.get('Brand', '')).lower()
            contaminant = str(rec.get('Contaminant', '')).lower()
            health_concern = str(rec.get('Health Concern', 'Data Not Available'))
            
            norm_contaminant = self._normalize_str(contaminant)
            if normalized_name in norm_contaminant or norm_contaminant in normalized_name:
                recalls_notices.append({
                    "brand": rec.get('Brand', 'Data Not Available'),
                    "product": rec.get('Product / Variant', 'Data Not Available'),
                    "hazard": rec.get('Hazard Category', 'Data Not Available'),
                    "reason": rec.get('Reason Present / Cause', 'Data Not Available'),
                    "health_concern": health_concern,
                    "action": rec.get('Regulatory Action & Date', 'Data Not Available')
                })

        return {
            "name": name,
            "ins_no": ins_no,
            "category": function,
            "purpose": function if function != "Data Not Available" else "Food Additive",
            "safety_status": "Banned" if risk_level == "High Risk" else ("Restricted" if risk_level == "Moderate Risk" else "Approved"),
            "adi": "Data Not Available",
            "max_limit": countries_data["India (FSSAI)"]["limit"] if countries_data["India (FSSAI)"]["status"] != "Not Available" else "Data Not Available",
            "unit": "Data Not Available",
            "detected_qty": "Data Not Available",
            "exceeds_limit": "Data Not Available",
            "scientific_notes": notes if notes != 'nan' else "Data Not Available",
            "health_considerations": health_reason if health_reason != 'nan' else "Data Not Available",
            "allergy_warnings": "Contains Soy derivative" if "lecithin" in name.lower() else "Data Not Available",
            "special_population_warnings": "May have an adverse effect on activity and attention in children" if "150d" in ins_no.lower() or "127" in ins_no.lower() or "924a" in ins_no.lower() or "952" in ins_no.lower() else "Data Not Available",
            "risk_level": risk_level,
            "countries": countries_data,
            "recalls": recalls_notices
        }

    def _parse_status_and_limit(self, limit_str: str) -> (str, str):
        """Converts an Excel limit text to standard status badge name and formatted limit."""
        norm = limit_str.lower()
        if not norm or norm == 'nan' or norm == 'data not available':
            return "Not Available", "Data Not Available"

        if "prohibited" in norm or "banned" in norm or "not permitted" in norm or "not approved" in norm:
            return "Banned", "Prohibited"
        elif "permitted" in norm or "gmp" in norm or "quantum satis" in norm or "allowed" in norm:
            if "limit" in norm or "specified" in norm or "up to" in norm or "maximum" in norm:
                return "Restricted", limit_str
            return "Approved", limit_str
        elif "restricted" in norm or "maximum" in norm or "mg/kg" in norm or "ppm" in norm or "%" in norm:
            return "Restricted", limit_str
        else:
            return "Restricted", limit_str

manager = AdditiveRegulatoryReportManager()

def get_additives_report(ingredients: List[str]) -> List[Dict[str, Any]]:
    """Helper entrypoint to run additive checks on a list of ingredients."""
    report = []
    for ing in ingredients:
        res = manager.lookup_additive(ing)
        if res:
            report.append(res)
    return report
