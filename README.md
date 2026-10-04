\# TraceNova



AI-Powered Unified Cyber Fraud Analysis \& Digital Artifact Correlator



TraceNova is a cybersecurity investigation platform designed to help investigators analyze and correlate digital evidence from multiple sources such as CDR, IPDR, banking/UPI data, email data and other digital artifacts.



The system combines evidence ingestion, normalization, entity resolution, relationship analysis and risk scoring to help investigators understand connections between suspicious entities and identify high-risk activity.



\## Key Features



\* Evidence upload and ingestion

\* CDR/IPDR and digital evidence analysis

\* Entity extraction and normalization

\* Entity relationship and correlation analysis

\* Risk scoring for suspicious activity

\* Investigation case management

\* Graph-based relationship analysis

\* Automated investigation summary

\* REST APIs for analysis and investigation workflows

\* Investigator dashboard



\## Tech Stack



\### Backend



\* Python

\* FastAPI

\* REST API

\* SQL database

\* Pandas

\* Scikit-learn



\### Frontend



\* React

\* Vite

\* JavaScript

\* CSS



\### Development Tools



\* VS Code

\* Git \& GitHub

\* Postman



\## Project Structure



```text

TraceNova/

│

├── backend/

│   ├── routes/

│   ├── services/

│   ├── utils/

│   ├── ...

│

├── frontend/

│   ├── src/

│   ├── public/

│   ├── ...

│

├── .gitignore

└── README.md

```



\## Backend Services



The backend contains modules for:



\* Evidence ingestion

\* Data normalization

\* Entity resolution

\* Graph generation

\* Risk analysis

\* Investigation report generation

\* Evidence hashing



\## How It Works



1\. Investigator creates or selects an investigation case.

2\. Digital evidence is uploaded to the system.

3\. The backend ingests and normalizes the evidence.

4\. Important entities such as phone numbers, UPI IDs, IP addresses, IMEI/IMSI and email identifiers are extracted.

5\. Related entities are correlated to identify relationships.

6\. A relationship graph is generated.

7\. Risk analysis identifies suspicious or high-risk activity.

8\. The investigator can review the results through the dashboard.



\## Running the Project Locally



\### Backend



Open a terminal inside the backend directory:



```bash

cd backend

```



Create and activate a Python virtual environment:



```bash

python -m venv venv

```



Windows PowerShell:



```powershell

.\\venv\\Scripts\\Activate.ps1

```



Install dependencies:



```bash

pip install -r requirements.txt

```



Start the FastAPI server:



```bash

uvicorn main:app --reload

```



The backend API will normally be available at:



```text

http://127.0.0.1:8000

```



FastAPI documentation:



```text

http://127.0.0.1:8000/docs

```



\### Frontend



Open another terminal:



```bash

cd frontend

```



Install dependencies:



```bash

npm install

```



Start the development server:



```bash

npm run dev

```



The frontend URL will be shown in the terminal.



\## Security



Environment variables and secret credentials should be stored in `.env` files and should not be committed to GitHub.



\## Future Scope



\* Machine learning based fraud-risk prediction

\* Advanced graph analytics

\* Real-time evidence analysis

\* Improved investigator workflow

\* Automated report generation

\* Deployment on cloud infrastructure

\* Advanced anomaly detection



\## Project Status



TraceNova is an actively developed cybersecurity investigation project focused on unified digital evidence analysis and correlation.



