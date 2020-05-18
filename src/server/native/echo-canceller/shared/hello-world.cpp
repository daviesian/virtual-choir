#include <iostream> // std::cout
#include <string>

#include "simple-args.h"

int main(int argc, char* argv[]) {
	SimpleArgs args(argc, argv);

	std::string name = args.arg<std::string>("name", "your name", "World");
	if (args.error()) return args.help();

	std::cout << "Hello, " << name << "!\n";
}