from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
import json


def signin(request):
    if request.user.is_authenticated:  # 檢查是否已登入
        return redirect("index")  # 如果已登入，跳轉到 index
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        # 驗證帳號密碼
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)  # 設置 session，登入成功
            return JsonResponse({"message": "登入成功！"}, status=200)
        else:
            return JsonResponse({"error": "帳號或密碼錯誤！"}, status=401)
    return render(request, "config/auth/signin.html")


def logout_view(request):
    logout(request)
    return redirect("signin")
