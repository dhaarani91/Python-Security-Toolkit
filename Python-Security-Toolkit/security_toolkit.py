import string

def password_checker():
    password = input("Enter a password to check: ")

    score = 0

    if len(password) >= 8:
        score += 1

    if any(char.isupper() for char in password):
        score += 1

    if any(char.islower() for char in password):
        score += 1

    if any(char.isdigit() for char in password):
        score += 1

    if any(char in string.punctuation for char in password):
        score += 1

    print("\nPassword Analysis:")

    if score <= 2:
        print("Weak Password")
    elif score <= 4:
        print("Moderate Password")
    else:
        print("Strong Password")

password_checker()