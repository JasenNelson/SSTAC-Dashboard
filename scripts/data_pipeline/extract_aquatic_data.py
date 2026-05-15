import os
import json
import pandas as pd
import numpy as np
import pdfplumber

class AquaticDataExtractor:
    def __init__(self):
        self.data_frames = []

    def process_csv_batch(self, input_dir):
        """
        Loops through all CSVs in the specified input_dir, reading and cleaning the data,
        safely handling missing values by standardizing them to NaN.
        """
        if not os.path.exists(input_dir):
            print(f"Directory {input_dir} does not exist.")
            return

        for filename in os.listdir(input_dir):
            if filename.endswith(".csv"):
                filepath = os.path.join(input_dir, filename)
                try:
                    df = pd.read_csv(filepath)
                    
                    # Standardize missing values to NaN
                    df.replace({"": np.nan, " ": np.nan, "NA": np.nan, "N/A": np.nan, "null": np.nan}, inplace=True)
                    df.fillna(np.nan, inplace=True)
                    
                    # Extract bioavailability metrics and handle <MDL
                    df = self.extract_bioavailability_metrics(df)
                    
                    # Store processed data
                    self.data_frames.append(df)
                    print(f"Successfully processed {filename}")
                except Exception as e:
                    print(f"Error processing {filename}: {e}")
                    
    def extract_bioavailability_metrics(self, df):
        """
        Extracts and cleans bioavailability metrics such as:
        - (AVS/SEM) Acid Volatile Sulfides / Simultaneously Extracted Metals
        - (TOC) Total Organic Carbon
        Also handles '<MDL' by standardizing it to NaN.
        """
        # Clean <MDL in all object (string) columns
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].apply(lambda x: np.nan if isinstance(x, str) and '<MDL' in x else x)
        
        # Here we make sure relevant columns are available or clean them if necessary.
        # This implementation robustly extracts AVS/SEM and TOC if they exist in the dataset.
        bioavailability_cols = [
            'AVS', 'SEM', 'AVS/SEM', 'TOC', 'Acid Volatile Sulfides', 
            'Simultaneously Extracted Metals', 'Total Organic Carbon'
        ]
        
        # We can create a consolidated column or ensure they are properly typed.
        for col in df.columns:
            if any(b_col.lower() in col.lower() for b_col in bioavailability_cols):
                # Ensure numerical typing for bioavailability metrics if possible
                df[col] = pd.to_numeric(df[col], errors='ignore')
                
        return df

    def export_to_json(self, output_path):
        """
        Export aggregated data to JSON.
        """
        if not self.data_frames:
            print("No data to export.")
            # We will create an empty JSON array if there's no data to maintain pipeline integrity
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w') as f:
                json.dump([], f)
            return

        try:
            # Combine all dataframes
            combined_df = pd.concat(self.data_frames, ignore_index=True)
            
            # Replace NaN with None so it becomes null in JSON
            combined_df = combined_df.replace({np.nan: None})
            
            # Create output directory if it doesn't exist
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
                
            # Export to json
            combined_df.to_json(output_path, orient='records', indent=4)
            print(f"Data successfully exported to {output_path}")
        except Exception as e:
            print(f"Error exporting data to JSON: {e}")

if __name__ == "__main__":
    extractor = AquaticDataExtractor()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    raw_data_dir = os.path.join(project_root, "matrix_research", "raw_data")
    output_path = os.path.join(project_root, "matrix_research", "processed_data", "aquatic_baseline.json")
    
    extractor.process_csv_batch(raw_data_dir)
    extractor.export_to_json(output_path)
