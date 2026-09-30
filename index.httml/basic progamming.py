a = 10
b = 1000
count = 0
for num in range (a,b + 1):
    temp = num
    rev = 0
    while temp > 0:
        digit = temp % 10
        rev = rev + 10 + digit
        temp = temp // 10
        if rev == num:
            if num > 1:
                is_prime = True
                for i in range(2,num):
                    if num % i == 0:
                        is_prime = False
                        break
                    if is_prime:
                        count = count + 1
                        print(count)


