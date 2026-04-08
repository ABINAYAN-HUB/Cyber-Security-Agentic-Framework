---
name: cloud-security-audit
description: AWS/Azure/GCP/Firebase security audit — IAM misconfigs, exposed storage, privilege escalation, metadata attacks
---

# Cloud Security Audit Skill

Comprehensive cloud infrastructure security assessment.

## Phase 1: Cloud Asset Discovery
1. Use `cloud_enum` with provider "all" to discover S3, Azure, GCP, Firebase resources
2. Use `dns_recon` to enumerate cloud-specific DNS records (CNAME to *.amazonaws.com, etc.)
3. Use `subdomain_enum` to discover cloud-hosted subdomains
4. Use `shodan_search` query "org:target ssl.cert.subject.cn:target.com"
5. Use `web_search` for cloud configuration leaks: "site:github.com target aws_access_key OR AKIA"

## Phase 2: AWS Testing
6. S3 bucket policy check: `execute_command`: `aws s3 ls s3://bucket-name --no-sign-request`
7. Test S3 ACL: `execute_command`: `aws s3api get-bucket-acl --bucket name --no-sign-request`
8. Check for public snapshots: `execute_command`: `aws ec2 describe-snapshots --owner-ids ACCOUNT_ID`
9. Lambda function enumeration
10. IAM policy analysis: check for overly permissive policies

## Phase 3: Azure Testing
11. Azure blob anonymity: `execute_command`: `curl https://account.blob.core.windows.net/container?restype=container&comp=list`
12. Azure AD enumeration: `execute_command`: `python3 -c "import requests; r=requests.get('https://login.microsoftonline.com/target.com/.well-known/openid-configuration'); print(r.json())"`
13. Check Azure Storage Account public access
14. Azure function app enumeration

## Phase 4: GCP Testing
15. GCP bucket listing: `execute_command`: `curl https://storage.googleapis.com/bucket-name/`
16. GCP metadata endpoint (if SSRF found): http://metadata.google.internal/computeMetadata/v1/
17. Firebase database check: `read_url` on `https://project.firebaseio.com/.json`
18. GCP project enumeration via DNS

## Phase 5: Cross-Cloud Checks
19. Check for cloud metadata endpoints via SSRF
20. Test for exposed Kubernetes dashboards
21. Check for Docker registries: `execute_command`: `curl -s https://target:5000/v2/_catalog`
22. Test for exposed Terraform state files
23. Store all findings in `memory_store` and save report with `save_artifact`
